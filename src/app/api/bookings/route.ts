import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { randomBytes } from 'crypto'

// Cryptographically strong booking ref — 10 hex chars = ~1 trillion combos
function generateRef(): string {
    return 'BMG-' + randomBytes(5).toString('hex').toUpperCase()
}

export async function POST(req: NextRequest) {
    const { scheduleId, seatNumbers, name, phone } = await req.json()

    // ── Input validation ──────────────────────────────────────────────
    // Accept both single seat (legacy) and array of seats
    const seats: string[] = Array.isArray(seatNumbers)
        ? seatNumbers
        : seatNumbers ? [seatNumbers] : ([] as string[])

    if (!scheduleId || seats.length === 0 || !name?.trim() || !phone?.trim()) {
        return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }
    if (seats.length > 10) {
        return NextResponse.json({ error: 'Maximum 10 seats per booking' }, { status: 400 })
    }
    if (!/^09\d{8}$/.test(phone)) {
        return NextResponse.json({ error: 'Phone must be Ethiopian format: 09XXXXXXXX (10 digits)' }, { status: 400 })
    }
    // Sanitize name
    const cleanName = name.trim().replace(/[\x00-\x1F\x7F]/g, '').substring(0, 100)
    if (cleanName.length < 2) {
        return NextResponse.json({ error: 'Name must be at least 2 characters' }, { status: 400 })
    }

    // ── Validate schedule exists and is in the future ──────────────────
    const { data: schedule, error: schedError } = await supabaseAdmin
        .from('schedules')
        .select('id, departure_date, departure_time, status, routes(base_price_etb)')
        .eq('id', scheduleId)
        .single()

    if (schedError || !schedule) {
        return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }
    if (schedule.status !== 'SCHEDULED') {
        return NextResponse.json({ error: 'This schedule is no longer active' }, { status: 400 })
    }

    // Block booking for past dates
    const depDate = new Date(`${schedule.departure_date}T${schedule.departure_time || '23:59:59'}`)
    if (depDate < new Date()) {
        return NextResponse.json({ error: 'Cannot book a seat for a past departure' }, { status: 400 })
    }

    const pricePerSeat = (schedule.routes as any)?.base_price_etb ?? 0
    const totalPrice = pricePerSeat * seats.length

    // ── Find or create passenger ──────────────────────────────────────
    let passenger
    const { data: existing } = await supabaseAdmin
        .from('passengers')
        .select('id')
        .eq('phone', phone)
        .single()

    if (existing) {
        passenger = existing
    } else {
        const { data: newP, error: pErr } = await supabaseAdmin
            .from('passengers')
            .insert({ full_name: cleanName, phone })
            .select('id')
            .single()
        if (pErr) return NextResponse.json({ error: 'Could not create passenger' }, { status: 500 })
        passenger = newP
    }

    // ── Lock all seats atomically ─────────────────────────────────────
    const lockedSeatIds: string[] = []
    const failedSeats: string[] = []

    for (const seatNum of seats) {
        const { data: seat, error: sErr } = await supabaseAdmin
            .from('seats')
            .select('id')
            .eq('schedule_id', scheduleId)
            .eq('seat_number', seatNum)
            .eq('is_booked', false)
            .single()

        if (sErr || !seat) {
            failedSeats.push(seatNum)
            continue
        }

        await supabaseAdmin
            .from('seats')
            .update({ is_booked: true })
            .eq('id', seat.id)

        lockedSeatIds.push(seat.id)
    }

    // If ANY seats failed, unlock all we locked and report
    if (failedSeats.length > 0) {
        for (const seatId of lockedSeatIds) {
            await supabaseAdmin.from('seats').update({ is_booked: false }).eq('id', seatId)
        }
        return NextResponse.json({
            error: `Seat(s) ${failedSeats.join(', ')} are no longer available`,
        }, { status: 409 })
    }

    // ── Create booking records ────────────────────────────────────────
    // One booking ref for the whole group, one row per seat
    const groupRef = generateRef()
    const bookingInserts = lockedSeatIds.map((seatId, i) => ({
        booking_ref: seats.length === 1 ? groupRef : `${groupRef}-${i + 1}`,
        passenger_id: passenger.id,
        seat_traveller_name: cleanName,
        seat_id: seatId,
        trip_type: 'ONE_WAY',
        price_etb: pricePerSeat,
        payment_status: 'PENDING',
        status: 'CONFIRMED',
        group_ref: groupRef,
    }))

    const { error: bookErr } = await supabaseAdmin
        .from('bookings')
        .insert(bookingInserts)

    if (bookErr) {
        // Rollback seat locks
        for (const seatId of lockedSeatIds) {
            await supabaseAdmin.from('seats').update({ is_booked: false }).eq('id', seatId)
        }
        return NextResponse.json({ error: 'Could not create booking' }, { status: 500 })
    }

    // ── Chapa payment ─────────────────────────────────────────────────
    const chapaRes = await fetch('https://api.chapa.co/v1/transaction/initialize', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            amount: totalPrice,
            currency: 'ETB',
            phone_number: phone,
            first_name: cleanName.split(' ')[0],
            last_name: cleanName.split(' ')[1] ?? 'N/A',
            tx_ref: groupRef,
            callback_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/chapa`,
            return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/ticket/${groupRef}`,
            customization: {
                title: 'Bemengede',
                description: `${seats.length} seat${seats.length > 1 ? 's' : ''} - ${seats.join(' ')}`.replace(/[^a-zA-Z0-9\s\-_.]/g, '').substring(0, 50),
            },
        }),
    })

    const chapaData = await chapaRes.json()

    if (chapaData.status !== 'success') {
        return NextResponse.json({ error: 'Chapa: ' + JSON.stringify(chapaData) }, { status: 500 })
    }

    return NextResponse.json({
        checkoutUrl: chapaData.data.checkout_url,
        groupRef,
        seatCount: seats.length,
        totalPrice,
    })
}
