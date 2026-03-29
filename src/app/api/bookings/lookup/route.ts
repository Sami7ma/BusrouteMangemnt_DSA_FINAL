import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(req: NextRequest) {
    const phone = new URL(req.url).searchParams.get('phone')

    if (!phone) {
        return NextResponse.json({ error: 'Phone is required' }, { status: 400 })
    }

    // Find the passenger by phone
    const { data: passenger } = await supabaseAdmin
        .from('passengers')
        .select('id')
        .eq('phone', phone)
        .single()

    if (!passenger) {
        return NextResponse.json([])
    }

    // Get all their bookings
    const { data: bookings } = await supabaseAdmin
        .from('bookings')
        .select('*, seats(seat_number, seat_type, schedules(departure_date, departure_time))')
        .eq('passenger_id', passenger.id)
        .order('booked_at', { ascending: false })

    return NextResponse.json(bookings || [])
}
