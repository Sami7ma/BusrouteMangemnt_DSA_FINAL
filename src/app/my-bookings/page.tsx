"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function MyBookings() {
    const router = useRouter()
    const [phone, setPhone] = useState('')
    const [bookings, setBookings] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)

    const handleLookup = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!/^09\d{8}$/.test(phone)) {
            return alert('Enter a valid phone: 09XXXXXXXX')
        }
        setLoading(true)
        setSearched(true)

        const res = await fetch(`/api/bookings/lookup?phone=${phone}`)
        const data = await res.json()
        setBookings(data)
        setLoading(false)
    }

    return (
        <main style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto', fontFamily: 'system-ui' }}>
            <button onClick={() => router.push('/')} style={{ marginBottom: '1rem', cursor: 'pointer' }}>← Home</button>

            <h2>My Bookings</h2>
            <p style={{ color: '#666', marginBottom: '1rem' }}>Enter your phone number to find your bookings.</p>

            <form onSubmit={handleLookup} style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
                <input
                    placeholder="09XXXXXXXX"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    required
                    style={{ padding: '10px', fontSize: '1rem', flex: 1 }}
                />
                <button type="submit" disabled={loading}
                    style={{ padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    {loading ? 'Searching...' : 'Look Up'}
                </button>
            </form>

            {searched && !loading && bookings.length === 0 && (
                <p style={{ color: '#991b1b', background: '#fef2f2', padding: '1rem', borderRadius: '8px' }}>
                    No bookings found for this phone number.
                </p>
            )}

            {bookings.map(b => {
                const schedule = b.seats?.schedules
                const isExpired = schedule && new Date(`${schedule.departure_date}T23:59:59`) < new Date()
                const isCancelled = b.status === 'CANCELLED'

                let boxColor = '#fef9c3' // warning yellow for pending
                if (isCancelled) boxColor = '#fef2f2' // soft red
                else if (isExpired) boxColor = '#f3f4f6' // gray
                else if (b.payment_status === 'PAID') boxColor = '#f0fdf4' // soft green

                return (
                    <div key={b.id} style={{
                        border: '1px solid #ddd', borderRadius: '8px', padding: '1rem', marginBottom: '1rem',
                        background: boxColor,
                        opacity: isExpired || isCancelled ? 0.7 : 1
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <strong>{b.booking_ref}</strong>
                                <p style={{ margin: '0.25rem 0', color: '#666' }}>
                                    Seat {b.seats?.seat_number} • {b.price_etb} ETB
                                </p>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#888' }}>
                                    {b.seat_traveller_name} • {new Date(b.booked_at).toLocaleDateString()}
                                </p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{
                                    color: isCancelled ? '#dc2626' : isExpired ? '#6b7280' : b.payment_status === 'PAID' ? '#16a34a' : '#ca8a04',
                                    fontWeight: 'bold', fontSize: '0.85rem'
                                }}>
                                    {isCancelled ? '❌ CANCELLED' : isExpired ? '🕒 EXPIRED' : b.payment_status === 'PAID' ? '✅ PAID' : '⏳ PENDING'}
                                </span>

                                <br />
                                <button
                                    onClick={() => router.push(`/ticket/${b.booking_ref}`)}
                                    // Ghost out the button if it's inactive, but still keep it clickable to see the receipt.
                                    style={{
                                        marginTop: '0.5rem', padding: '6px 12px',
                                        background: isCancelled || isExpired ? '#e5e7eb' : '#2563eb',
                                        color: isCancelled || isExpired ? '#4b5563' : 'white',
                                        border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem'
                                    }}
                                >
                                    View Receipt
                                </button>
                                {!isCancelled && !isExpired && (
                                    <button
                                        onClick={async () => {
                                            if (!confirm('Are you sure you want to cancel this booking?')) return
                                            const res = await fetch('/api/bookings/cancel', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ bookingRef: b.booking_ref }),
                                            })
                                            const data = await res.json()
                                            if (data.success) {
                                                alert(`Cancelled!\n${data.refundMessage}\nRefund: ${data.refundAmount} ETB`)
                                                // Refresh the bookings list
                                                const refreshRes = await fetch(`/api/bookings/lookup?phone=${phone}`)
                                                setBookings(await refreshRes.json())
                                            } else {
                                                alert('Error: ' + data.error)
                                            }
                                        }}
                                        style={{ marginTop: '0.25rem', padding: '6px 12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                    >
                                        Cancel
                                    </button>
                                )}

                            </div>
                        </div>
                    </div>
                )
            })}
        </main>
    )
}
