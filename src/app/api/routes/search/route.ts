import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { NextResponse, NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const date = searchParams.get('date')

    if (!from || !to || !date) {
        return NextResponse.json(
            { error: 'Missing required params: from , to , date' },
            { status: 400 }
        )
    }
    const { data, error } = await supabase
        .from('schedules')
        .select(`
      id,
      departure_date,
      departure_time,
      arrival_time,
      status,
      buses ( plate_number, total_rows, total_cols ),
      routes (
        base_price_etb,
        distance_km,
        origin:cities!routes_origin_id_fkey ( name ),
        destination:cities!routes_destination_id_fkey ( name )
      )
    `)
        .eq('departure_date', date)
        .eq('status', 'SCHEDULED')
        .eq('routes.origin.name', from)
        .eq('routes.destination.name', to)
    if (error) {
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        )
    }
    return NextResponse.json(data)
}