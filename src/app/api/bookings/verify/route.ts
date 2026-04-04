import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Manual payment verification — used when Chapa can't reach localhost webhook
export async function GET(req: NextRequest) {
    const bookingRef = new URL(req.url).searchParams.get('ref')

    if (!bookingRef) {
        return NextResponse.json({ error: 'Missing booking ref' }, { status: 400 })
    }

    // 1. Check current booking status first
    const { data: booking } = await supabaseAdmin
        .from('bookings')
        .select('id, payment_status, booking_ref')
        .eq('booking_ref', bookingRef)
        .single()

    if (!booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (booking.payment_status === 'PAID') {
        return NextResponse.json({ status: 'already_paid' })
    }

    // 2. Ask Chapa if this transaction was paid
    const verifyRes = await fetch(`https://api.chapa.co/v1/transaction/verify/${bookingRef}`, {
        headers: { Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}` },
    })
    const verifyData = await verifyRes.json()

    if (verifyData.status === 'success') {
        // 3. Payment confirmed — update booking to PAID
        await supabaseAdmin
            .from('bookings')
            .update({
                payment_status: 'PAID',
                paid_at: new Date().toISOString(),
                chapa_tx_ref: bookingRef,
            })
            .eq('id', booking.id)

        return NextResponse.json({ status: 'paid', message: 'Payment verified and confirmed!' })
    }

    return NextResponse.json({ status: 'pending', message: 'Payment not yet received by Chapa' })
}
