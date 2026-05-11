import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createHmac } from 'crypto'

export async function POST(req: NextRequest) {
    // 1. Read raw body for signature verification
    const rawBody = await req.text()

    // 2. Verify webhook signature (Chapa sends x-chapa-signature header)
    const chapaSignature = req.headers.get('x-chapa-signature') || req.headers.get('chapa-signature')
    if (chapaSignature) {
        const secret = process.env.CHAPA_WEBHOOK_SECRET || process.env.CHAPA_SECRET_KEY!
        const expectedSig = createHmac('sha256', secret).update(rawBody).digest('hex')
        if (chapaSignature !== expectedSig) {
            console.error('Webhook: signature mismatch — rejecting')
            return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
        }
    }

    const body = JSON.parse(rawBody)
    const txRef = body.tx_ref || body.trx_ref

    if (!txRef) {
        return NextResponse.json({ error: 'Missing tx_ref' }, { status: 400 })
    }

    // 3. ALWAYS verify with Chapa API — never trust webhook body alone
    const verifyRes = await fetch(`https://api.chapa.co/v1/transaction/verify/${txRef}`, {
        headers: { Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}` },
    })
    const verifyData = await verifyRes.json()

    if (verifyData.status !== 'success') {
        return NextResponse.json({ error: 'Payment not verified by Chapa' }, { status: 400 })
    }

    // 4. Find all bookings in this group (multi-seat support)
    const { data: bookings } = await supabaseAdmin
        .from('bookings')
        .select('id, price_etb, payment_status')
        .or(`booking_ref.eq.${txRef},group_ref.eq.${txRef}`)

    if (!bookings || bookings.length === 0) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const alreadyPaid = bookings.every(b => b.payment_status === 'PAID')
    if (alreadyPaid) {
        return NextResponse.json({ status: 'already_paid' })
    }

    // 5. Verify amount matches total (prevent partial payment attacks)
    const totalExpected = bookings.reduce((sum, b) => sum + Number(b.price_etb), 0)
    const paidAmount = verifyData.data?.amount
    if (paidAmount && Number(paidAmount) < totalExpected) {
        console.error(`Webhook: amount mismatch — expected ${totalExpected}, got ${paidAmount}`)
        return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 })
    }

    // 6. Mark ALL bookings in group as PAID
    const bookingIds = bookings.map(b => b.id)
    await supabaseAdmin
        .from('bookings')
        .update({
            payment_status: 'PAID',
            paid_at: new Date().toISOString(),
            chapa_tx_ref: txRef,
        })
        .in('id', bookingIds)

    return NextResponse.json({ received: true })
}

// Chapa sometimes sends GET to verify the endpoint exists
export async function GET() {
    return NextResponse.json({ status: 'webhook active' })
}
