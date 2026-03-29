import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// This endpoint is called by the ticket page to verify payment status.
// If booking is still PENDING, it actively checks with Chapa and updates the DB.
export async function GET(req: NextRequest) {
    const ref = new URL(req.url).searchParams.get('ref')
    if (!ref) return NextResponse.json({ error: 'Ref required' }, { status: 400 })

    const { data: booking, error } = await supabaseAdmin
        .from('bookings')
        .select('*, seats(seat_number, seat_type), passengers(full_name, phone)')
        .eq('booking_ref', ref)
        .single()

    if (error || !booking) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // If already PAID or CANCELLED — just return it
    if (booking.payment_status !== 'PENDING') {
        return NextResponse.json(booking)
    }

    // Still PENDING — ask Chapa if it was actually paid
    try {
        const verifyRes = await fetch(`https://api.chapa.co/v1/transaction/verify/${ref}`, {
            headers: { Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}` },
        })
        const verifyData = await verifyRes.json()

        if (verifyData.status === 'success' && verifyData.data?.status === 'success') {
            // Chapa confirmed — mark as PAID
            await supabaseAdmin
                .from('bookings')
                .update({
                    payment_status: 'PAID',
                    paid_at: new Date().toISOString(),
                    chapa_tx_ref: ref,
                })
                .eq('booking_ref', ref)

            return NextResponse.json({ ...booking, payment_status: 'PAID' })
        }
    } catch {
        // Chapa check failed — return current state
    }

    return NextResponse.json(booking)
}
