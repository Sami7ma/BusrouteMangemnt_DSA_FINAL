import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
    const { bookingRef, phone } = await req.json()

    // Require both booking ref AND phone for ownership verification
    if (!bookingRef || !phone) {
        return NextResponse.json({ error: 'Booking ref and phone number are required' }, { status: 400 })
    }

    // 1. Find all bookings in this group (supports both single and group bookings)
    const { data: bookings, error } = await supabaseAdmin
        .from('bookings')
        .select(`*, passengers ( phone )`)
        .or(`booking_ref.eq.${bookingRef},group_ref.eq.${bookingRef}`)

    if (error || !bookings || bookings.length === 0) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // 2. Verify ownership — phone must match the passenger who booked
    const passengerPhone = (bookings[0].passengers as any)?.phone
    if (passengerPhone !== phone) {
        return NextResponse.json({ error: 'Unauthorized — phone does not match booking owner' }, { status: 403 })
    }

    // Check none are already cancelled
    const alreadyCancelled = bookings.filter(b => b.status === 'CANCELLED')
    const toCancel = bookings.filter(b => b.status !== 'CANCELLED')
    if (toCancel.length === 0) {
        return NextResponse.json({ error: 'All bookings already cancelled' }, { status: 400 })
    }

    // 3. Get the seat IDs to release
    const seatIds = toCancel.map(b => b.seat_id).filter(Boolean)

    // 4. Get departure info from the first seat
    let hoursUntil = 999
    if (seatIds.length > 0) {
        const { data: seat } = await supabaseAdmin
            .from('seats')
            .select('schedule_id')
            .eq('id', seatIds[0])
            .single()

        if (seat) {
            const { data: schedule } = await supabaseAdmin
                .from('schedules')
                .select('departure_date, departure_time')
                .eq('id', seat.schedule_id)
                .single()

            if (schedule) {
                const departureStr = `${schedule.departure_date}T${schedule.departure_time}`
                const departureTime = new Date(departureStr).getTime()
                hoursUntil = (departureTime - Date.now()) / (1000 * 60 * 60)
            }
        }
    }

    // 5. Block cancellation if trip already departed
    if (hoursUntil < -1) {
        return NextResponse.json({ error: 'Trip has already departed — cannot cancel' }, { status: 400 })
    }

    // 6. Determine refund percentage
    let refundPercent = 0
    let refundMessage = ''

    if (hoursUntil > 24) {
        refundPercent = 90
        refundMessage = 'Full refund (90%) — more than 24 hours before departure'
    } else if (hoursUntil > 6) {
        refundPercent = 50
        refundMessage = 'Partial refund (50%) — 6–24 hours before departure'
    } else {
        refundPercent = 0
        refundMessage = 'No refund — less than 6 hours before departure'
    }

    const totalPrice = toCancel.reduce((sum, b) => sum + Number(b.price_etb || 0), 0)
    const refundAmount = Math.round(totalPrice * (refundPercent / 100))

    // 7. Mark all bookings CANCELLED
    const bookingIds = toCancel.map(b => b.id)
    await supabaseAdmin
        .from('bookings')
        .update({ status: 'CANCELLED', cancelled_at: new Date().toISOString() })
        .in('id', bookingIds)

    // 8. Release all seats
    if (seatIds.length > 0) {
        await supabaseAdmin
            .from('seats')
            .update({ is_booked: false })
            .in('id', seatIds)
    }

    return NextResponse.json({
        success: true,
        cancelledCount: toCancel.length,
        refundPercent,
        refundAmount,
        refundMessage,
        bookingRef,
    })
}
