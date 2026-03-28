import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Helper to generate a short unique booking ref like "BMG-A3F29K"
function generateRef(): string {
    return 'BMG-' + Math.random().toString(36).substring(2, 8).toUpperCase()
}

export async function POST(req: NextRequest) {
    const { scheduleId, seatNumber, name, phone } = await req.json()

    // Input validation
    if (!scheduleId || !seatNumber || !name?.trim() || !phone?.trim()) {
        return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }
    if (!/^09\d{8}$/.test(phone)) {
        return NextResponse.json({ error: 'Phone must be Ethiopian format: 09XXXXXXXX (10 digits)' }, { status: 400 })
    }

    // ── STEP 1: Find or create the passenger ──────────────────────────────
    // We check if this phone number already exists. If so, we reuse that record.
    // If not, we create a new one. This is "upsert" logic.
    let passenger
    const { data: existing } = await supabaseAdmin
        .from('passengers')
        .select('id')
        .eq('phone', phone)
        .single()

    if (existing) {
        passenger = existing
    } else {
        const { data: newPassenger, error: pError } = await supabaseAdmin
            .from('passengers')
            .insert({ full_name: name, phone })
            .select('id')
            .single()

        if (pError) return NextResponse.json({ error: 'Could not create passenger' }, { status: 500 })
        passenger = newPassenger
    }

    // ── STEP 2: Find the seat and mark it as reserved ──────────────────────
    const { data: seat, error: seatError } = await supabaseAdmin
        .from('seats')
        .select('id')
        .eq('schedule_id', scheduleId)
        .eq('seat_number', seatNumber)
        .eq('is_booked', false) // Only proceed if seat is still free!
        .single()

    if (seatError || !seat) {
        return NextResponse.json({ error: 'Seat is no longer available' }, { status: 409 })
    }

    // Temporarily lock the seat so no one else can grab it during payment
    await supabaseAdmin
        .from('seats')
        .update({ is_booked: true })
        .eq('id', seat.id)

    // ── STEP 3: Get the price from the route ──────────────────────────────
    const { data: schedule } = await supabaseAdmin
        .from('schedules')
        .select('routes(base_price_etb)')
        .eq('id', scheduleId)
        .single()

    const price = (schedule?.routes as any)?.base_price_etb ?? 0
    const bookingRef = generateRef()

    // ── STEP 4: Create a PENDING booking record ────────────────────────────
    const { error: bookingError } = await supabaseAdmin
        .from('bookings')
        .insert({
            booking_ref: bookingRef,
            passenger_id: passenger.id,
            seat_traveller_name: name,
            seat_id: seat.id,
            trip_type: 'ONE_WAY',
            price_etb: price,
            payment_status: 'PENDING',
            status: 'CONFIRMED',
        })

    if (bookingError) {
        // If booking creation fails, unlock the seat
        await supabaseAdmin.from('seats').update({ is_booked: false }).eq('id', seat.id)
        return NextResponse.json({ error: 'Could not create booking' }, { status: 500 })
    }

    // ── STEP 5: Call Chapa API to create a payment link ────────────────────
    const chapaRes = await fetch('https://api.chapa.co/v1/transaction/initialize', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            amount: price,
            currency: 'ETB',
            email: `bemengede.${phone}@gmail.com`,
            first_name: name.split(' ')[0],
            last_name: name.split(' ')[1] ?? 'N/A',
            tx_ref: bookingRef,
            callback_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/chapa`,
            return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/ticket/${bookingRef}`,
            customization: {
                title: 'Bemengede',
                description: `Seat ${seatNumber}`,
            },
        }),
    })

    const chapaData = await chapaRes.json()

    if (chapaData.status !== 'success') {
        return NextResponse.json({ error: 'Chapa: ' + JSON.stringify(chapaData) }, { status: 500 })
    }

    // Return the Chapa checkout URL to the frontend
    return NextResponse.json({ checkoutUrl: chapaData.data.checkout_url })
}
