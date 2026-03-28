import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
    const { bookingRef } = await req.json()

    if (!bookingRef) {
        return NextResponse.json({ error: 'Booking ref is required' }, { status: 400 })
    }

    // 1. Find the booking + its seat + the schedule departure
    const { data: booking, error } = await supabaseAdmin
        .from('bookings')
        .select(`
            *,
            seats ( id, schedule_id, seat_number ),
            passengers ( phone )
        `)
        .eq('booking_ref', bookingRef)
        .single()

    if (error || !booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (booking.status === 'CANCELLED') {
        return NextResponse.json({ error: 'Already cancelled' }, { status: 400 })
    }

    // 2. Get the departure date/time from the schedule
    const { data: schedule } = await supabaseAdmin
        .from('schedules')
        .select('departure_date, departure_time')
        .eq('id', booking.seats.schedule_id)
        .single()

    // 3. Calculate hours until departure
    const departureStr = `${schedule?.departure_date}T${schedule?.departure_time}`
    const departureTime = new Date(departureStr).getTime()
    const now = Date.now()
    const hoursUntil = (departureTime - now) / (1000 * 60 * 60)

    // 4. Determine refund percentage based on our policy
    let refundPercent = 0
    let refundMessage = ''

    if (hoursUntil > 24) {
        refundPercent = 90
        refundMessage = 'Full refund (90%) — more than 24 hours before departure'
    } else if (hoursUntil > 6) {
        refundPercent = 50
        refundMessage = 'Partial refund (50%) — 6-24 hours before departure'
    } else {
        refundPercent = 0
        refundMessage = 'No refund — less than 6 hours before departure'
    }

    const refundAmount = Math.round(booking.price_etb * (refundPercent / 100))

    // 5. Update booking to CANCELLED
    await supabaseAdmin
        .from('bookings')
        .update({
            status: 'CANCELLED',
            cancelled_at: new Date().toISOString(),
        })
        .eq('id', booking.id)

    // 6. Release the seat so someone else can book it
    await supabaseAdmin
        .from('seats')
        .update({ is_booked: false })
        .eq('id', booking.seats.id)

    return NextResponse.json({
        success: true,
        refundPercent,
        refundAmount,
        refundMessage,
        bookingRef,
    })
}
