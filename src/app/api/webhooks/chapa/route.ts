import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
    const body = await req.json()
    const txRef = body.tx_ref || body.trx_ref

    if (!txRef) {
        return NextResponse.json({ error: 'Missing tx_ref' }, { status: 400 })
    }

    // Verify with Chapa that this payment is legit
    const verifyRes = await fetch(`https://api.chapa.co/v1/transaction/verify/${txRef}`, {
        headers: { Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}` },
    })
    const verifyData = await verifyRes.json()

    if (verifyData.status !== 'success') {
        return NextResponse.json({ error: 'Payment not verified' }, { status: 400 })
    }

    // Update booking to PAID
    await supabaseAdmin
        .from('bookings')
        .update({
            payment_status: 'PAID',
            paid_at: new Date().toISOString(),
            chapa_tx_ref: txRef,
        })
        .eq('booking_ref', txRef)

    return NextResponse.json({ received: true })
}

// Chapa sometimes sends GET to verify the endpoint exists
export async function GET() {
    return NextResponse.json({ status: 'webhook active' })
}
