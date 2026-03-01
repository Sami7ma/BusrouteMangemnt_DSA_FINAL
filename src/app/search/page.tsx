"use client"

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

export default function SearchResults() {
    const searchParams = useSearchParams()
    const router = useRouter()

    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const date = searchParams.get('date')
    const type = searchParams.get('type')

    const [schedules, setSchedules] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchSchedules() {
            if (!from || !to || !date) return

            const res = await fetch(`/api/routes/search?from=${from}&to=${to}&date=${date}&type=${type}`)
            const data = await res.json()
            setSchedules(data)
            setLoading(false)
        }

        fetchSchedules()
    }, [from, to, date, type])

    return (
        <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', fontFamily: 'system-ui' }}>
            <button
                onClick={() => router.back()}
                style={{ marginBottom: '2rem', padding: '8px 16px', cursor: 'pointer' }}
            >
                ← Back to Search
            </button>

            <h1>Buses from {from} to {to}</h1>
            <p style={{ color: '#666' }}>Date: {date} | Trip: {type === 'ROUND_TRIP' ? 'Round Trip' : 'One Way'}</p>

            <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {loading ? (
                    <p>Loading schedules...</p>
                ) : schedules.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', background: '#fef2f2', color: '#991b1b', borderRadius: '8px' }}>
                        No buses found for this date. Try another day.
                    </div>
                ) : (
                    schedules.map(schedule => (
                        <div key={schedule.id} style={{ border: '1px solid #ddd', padding: '1.5rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: '0 0 0.5rem 0' }}>{schedule.departure_time} - {schedule.arrival_time || 'TBD'}</h3>
                                <p style={{ margin: 0, color: '#666' }}>Bus: {schedule.buses.plate_number} • {schedule.routes.distance_km} km</p>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                                <h2 style={{ margin: '0 0 0.5rem 0', color: '#16a34a' }}>{schedule.routes.base_price_etb} ETB</h2>
                                <button
                                    onClick={() => router.push(`/book/${schedule.id}`)}
                                    style={{ padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                    Select Seats
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </main>
    )
}
