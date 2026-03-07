"use client"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SeatPicker() {
    const { id } = useParams() // The schedule ID from the URL
    const router = useRouter()

    const [schedule, setSchedule] = useState<any>(null)
    const [seats, setSeats] = useState<any[]>([])
    const [selectedSeat, setSelectedSeat] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadData() {
            // 1. Load the schedule info
            const { data: schedData } = await supabase
                .from('schedules')
                .select('*, buses(*), routes(origin:cities!routes_origin_id_fkey(name), destination:cities!routes_destination_id_fkey(name))')
                .eq('id', id)
                .single()

            setSchedule(schedData)

            // 2. Load the seats for this schedule
            const { data: seatData } = await supabase
                .from('seats')
                .select('*')
                .eq('schedule_id', id)
                .order('seat_number')

            setSeats(seatData || [])
            setLoading(false)
        }

        if (id) {
            loadData()

            // Subscribe to real-time changes on the seats table for this schedule
            const channel = supabase
                .channel('seats_changes')
                .on('postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'seats',
                        filter: `schedule_id=eq.${id}`
                    },
                    (payload) => {
                        // Instantly update the seat status in the UI without a page refresh
                        setSeats(currentSeats =>
                            currentSeats.map(seat =>
                                seat.id === payload.new.id ? { ...seat, is_booked: payload.new.is_booked } : seat
                            )
                        )
                    })
                .subscribe()

            return () => {
                supabase.removeChannel(channel)
            }
        }
    }, [id])

    if (loading) return <main style={{ padding: '2rem' }}>Loading seats...</main>
    if (!schedule) return <main style={{ padding: '2rem' }}>Schedule not found.</main>

    // Group seats by row for the grid view
    // We extract the number part from the seat label (e.g. "1A" -> "1")
    const rows = Array.from(
        new Set(seats.map(s => s.seat_number.match(/\d+/)?.[0]))
    ).sort((a, b) => parseInt(a!) - parseInt(b!))

    return (
        <main style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto', fontFamily: 'system-ui' }}>
            <button onClick={() => router.back()} style={{ marginBottom: '1rem', cursor: 'pointer' }}>← Back</button>

            <h2>Select your seat</h2>
            <p>{schedule.routes.origin.name} → {schedule.routes.destination.name}</p>
            <p style={{ color: '#666' }}>{schedule.departure_date} at {schedule.departure_time}</p>

            <div style={{ marginTop: '2rem', padding: '2rem', background: '#f8fafc', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>

                <div style={{ padding: '10px 40px', background: '#cbd5e1', borderRadius: '8px', marginBottom: '1rem' }}>FRONT OF BUS</div>

                {Array.from(rows).map((rowNum) => {
                    // Get the 4 seats for this row (A, B, C, D) using exact number match, not startsWith
                    const rowSeats = seats.filter(s => s.seat_number.match(/\d+/)?.[0] === rowNum)

                    return (
                        <div key={rowNum} style={{ display: 'flex', gap: '0.5rem', width: '100%', justifyContent: 'center' }}>
                            {rowSeats.map((seat, index) => {
                                const isSelected = selectedSeat === seat.seat_number
                                const isBooked = seat.is_booked

                                return (
                                    <div key={seat.id} style={{ display: 'flex', alignItems: 'center' }}>
                                        <button
                                            disabled={isBooked}
                                            onClick={() => setSelectedSeat(seat.seat_number)}
                                            style={{
                                                padding: '1rem',
                                                width: '50px',
                                                height: '50px',
                                                borderRadius: '8px',
                                                border: isSelected ? '2px solid #2563eb' : '1px solid #ddd',
                                                background: isBooked ? '#fca5a5' : isSelected ? '#bfdbfe' : 'white',
                                                cursor: isBooked ? 'not-allowed' : 'pointer',
                                                fontWeight: 'bold',
                                                color: isBooked ? '#991b1b' : '#333'
                                            }}
                                        >
                                            {seat.seat_number}
                                        </button>
                                        {/* Add an aisle gap in the middle (after 2nd seat) */}
                                        {index === 1 && <div style={{ width: '40px' }} />}
                                    </div>
                                )
                            })}
                        </div>
                    )
                })}
            </div>

            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3>{selectedSeat ? `Seat ${selectedSeat}` : 'No seat selected'}</h3>
                </div>
                <button
                    disabled={!selectedSeat}
                    onClick={() => alert(`Next step: Payment for seat ${selectedSeat}`)}
                    style={{ padding: '12px 24px', background: selectedSeat ? '#2563eb' : '#94a3b8', color: 'white', border: 'none', borderRadius: '4px', cursor: selectedSeat ? 'pointer' : 'not-allowed' }}
                >
                    Continue
                </button>
            </div>
        </main>
    )
}
