import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Seat lock timeout — releases seats that were locked for payment but never paid
// Call this via: GET /api/cron/release-seats
// In production, set up a cron job (Vercel Cron, Supabase Edge Function, or external)
// to hit this endpoint every 5 minutes.

export async function GET() {
    const TIMEOUT_MINUTES = 15

    // 1. Find all PENDING bookings older than 15 minutes
    const cutoff = new Date(Date.now() - TIMEOUT_MINUTES * 60 * 1000).toISOString()

    const { data: staleBookings, error } = await supabaseAdmin
        .from('bookings')
        .select('id, seat_id, booking_ref, group_ref')
        .eq('payment_status', 'PENDING')
        .lt('booked_at', cutoff)

    if (error) {
        console.error('Release seats cron error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!staleBookings || staleBookings.length === 0) {
        return NextResponse.json({ released: 0, message: 'No stale bookings found' })
    }

    // 2. Collect seat IDs to release
    const seatIds = staleBookings.map(b => b.seat_id).filter(Boolean)
    const bookingIds = staleBookings.map(b => b.id)

    // 3. Mark bookings as EXPIRED
    await supabaseAdmin
        .from('bookings')
        .update({ status: 'CANCELLED', cancelled_at: new Date().toISOString() })
        .in('id', bookingIds)

    // 4. Release the seats
    if (seatIds.length > 0) {
        await supabaseAdmin
            .from('seats')
            .update({ is_booked: false })
            .in('id', seatIds)
    }

    console.log(`Released ${seatIds.length} stale seat(s) from ${staleBookings.length} expired booking(s)`)

    return NextResponse.json({
        released: seatIds.length,
        bookingsCancelled: bookingIds.length,
        message: `Released ${seatIds.length} seat(s) from ${bookingIds.length} unpaid booking(s)`,
    })
}
