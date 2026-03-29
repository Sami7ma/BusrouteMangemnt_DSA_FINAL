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
                const isCancelled = b.status === 'CANCELLED'
                const isPaid = b.payment_status === 'PAID'

                const cardBg = isCancelled ? '#fef2f2' : isPaid ? '#f0fdf4' : '#fef9c3'
                const cardBorder = isCancelled ? '#fca5a5' : isPaid ? '#86efac' : '#fde68a'
                const statusColor = isCancelled ? '#dc2626' : isPaid ? '#16a34a' : '#ca8a04'
                const statusLabel = isCancelled ? '❌ Cancelled' : isPaid ? '✅ Paid' : '⏳ Pending'

                return (
                    <div key={b.id} style={{
                        border: `1px solid ${cardBorder}`,
                        borderRadius: '10px',
                        padding: '1rem 1.25rem',
                        marginBottom: '1rem',
                        background: cardBg,
                        opacity: isCancelled ? 0.75 : 1,
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <p style={{ margin: '0 0 0.2rem', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1rem' }}>
                                    {b.booking_ref}
                                </p>
                                <p style={{ margin: '0 0 0.2rem', color: '#555', fontSize: '0.9rem' }}>
                                    Seat {b.seats?.seat_number} • <strong>{b.price_etb} ETB</strong>
                                </p>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#888' }}>
                                    {b.seat_traveller_name} • {new Date(b.booked_at).toLocaleDateString()}
                                </p>
                            </div>
                            <span style={{ color: statusColor, fontWeight: 'bold', fontSize: '0.8rem', whiteSpace: 'nowrap', paddingLeft: '0.5rem' }}>
                                {statusLabel}
                            </span>
                        </div>

                        {!isCancelled && (
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                                <button
                                    onClick={() => router.push(`/ticket/${b.booking_ref}`)}
                                    style={{ flex: 1, padding: '7px 0', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.82rem' }}
                                >
                                    View Ticket
                                </button>
                                {isPaid && (
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
                                                alert(`Booking cancelled.\n${data.refundMessage}\nRefund amount: ${data.refundAmount} ETB`)
                                                const refreshRes = await fetch(`/api/bookings/lookup?phone=${phone}`)
                                                setBookings(await refreshRes.json())
                                            } else {
                                                alert('Error: ' + data.error)
                                            }
                                        }}
                                        style={{ flex: 1, padding: '7px 0', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.82rem' }}
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>
                        )}

                        {isCancelled && b.cancelled_at && (
                            <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: '#dc2626' }}>
                                Cancelled on {new Date(b.cancelled_at).toLocaleString()}
                            </p>
                        )}
                    </div>
                )
            })}
        </main>
    )
}
