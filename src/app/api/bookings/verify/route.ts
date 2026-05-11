import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Manual payment verification — used when Chapa can't reach localhost webhook
export async function GET(req: NextRequest) {
    const bookingRef = new URL(req.url).searchParams.get('ref')
    const phone = new URL(req.url).searchParams.get('phone')

    if (!bookingRef) {
        return NextResponse.json({ error: 'Missing booking ref' }, { status: 400 })
    }

    // 1. Find all bookings (single or group)
    const { data: bookings } = await supabaseAdmin
        .from('bookings')
        .select('id, payment_status, booking_ref, price_etb, passengers ( phone )')
        .or(`booking_ref.eq.${bookingRef},group_ref.eq.${bookingRef}`)

    if (!bookings || bookings.length === 0) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // 2. If phone is provided, verify ownership
    if (phone) {
        const passengerPhone = (bookings[0].passengers as any)?.phone
        if (passengerPhone !== phone) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }
    }

    const alreadyPaid = bookings.every(b => b.payment_status === 'PAID')
    if (alreadyPaid) {
        return NextResponse.json({ status: 'already_paid' })
    }

    // 3. Ask Chapa if this transaction was paid
    const verifyRes = await fetch(`https://api.chapa.co/v1/transaction/verify/${bookingRef}`, {
        headers: { Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}` },
    })
    const verifyData = await verifyRes.json()

    if (verifyData.status === 'success') {
        // 4. Verify amount matches total
        const totalExpected = bookings.reduce((sum, b) => sum + Number(b.price_etb), 0)
        const paidAmount = verifyData.data?.amount
        if (paidAmount && Number(paidAmount) < totalExpected) {
            console.error(`Verify: amount mismatch — expected ${totalExpected}, got ${paidAmount}`)
            return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 })
        }

        // 5. Payment confirmed — update ALL bookings in group to PAID
        const bookingIds = bookings.map(b => b.id)
        await supabaseAdmin
            .from('bookings')
            .update({
                payment_status: 'PAID',
                paid_at: new Date().toISOString(),
                chapa_tx_ref: bookingRef,
            })
            .in('id', bookingIds)

        return NextResponse.json({
            status: 'paid',
            message: `Payment verified! ${bookings.length} seat${bookings.length > 1 ? 's' : ''} confirmed.`,
        })
    }

    return NextResponse.json({ status: 'pending', message: 'Payment not yet received by Chapa' })
}
