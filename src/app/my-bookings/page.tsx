"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function MyBookings() {
    const router = useRouter()
    const [phone, setPhone] = useState('')
    const [bookings, setBookings] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)
    const [cancellingId, setCancellingId] = useState<string | null>(null)

    const handleLookup = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!/^09\d{8}$/.test(phone)) return alert('Enter a valid phone: 09XXXXXXXX')
        setLoading(true)
        setSearched(true)

        const res = await fetch(`/api/bookings/lookup?phone=${phone}`)
        const data = await res.json()
        setBookings(data)
        setLoading(false)
    }

    const handleCancel = async (bookingRef: string) => {
        if (!confirm('Are you sure you want to cancel this booking?')) return
        setCancellingId(bookingRef)

        const res = await fetch('/api/bookings/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingRef }),
        })
        const data = await res.json()

        if (data.success) {
            alert(`Cancelled!\n${data.refundMessage}\nRefund: ${data.refundAmount} ETB`)
            const refreshRes = await fetch(`/api/bookings/lookup?phone=${phone}`)
            setBookings(await refreshRes.json())
        } else {
            alert('Error: ' + data.error)
        }
        setCancellingId(null)
    }

    return (
        <div style={{ minHeight: '100vh', padding: '2rem 1.5rem' }}>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>

                {/* Header */}
                <button className="back-btn animate-in" onClick={() => router.push('/')}>
                    ← Home
                </button>

                <div className="animate-in animate-in-delay-1" style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>
                    <h1 style={{ fontSize: '1.8rem' }}>My Bookings</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                        Enter your phone number to find your tickets.
                    </p>
                </div>

                {/* Search Form */}
                <form onSubmit={handleLookup} className="animate-in animate-in-delay-2" style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', marginBottom: '2rem' }}>
                    <input
                        className="input"
                        placeholder="09XXXXXXXX"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        required
                        style={{ flex: 1 }}
                    />
                    <button type="submit" disabled={loading} className="btn btn-gold">
                        {loading ? '...' : 'Look Up'}
                    </button>
                </form>

                {/* Empty State */}
                {searched && !loading && bookings.length === 0 && (
                    <div className="glass animate-in" style={{ padding: '3rem', textAlign: 'center' }}>
                        <p style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📭</p>
                        <h3 style={{ marginBottom: '0.5rem' }}>No bookings found</h3>
                        <p style={{ color: 'var(--text-muted)' }}>No tickets are associated with this phone number.</p>
                    </div>
                )}

                {/* Loading skeletons */}
                {loading && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {[1, 2, 3].map(i => (
                            <div key={i} className="skeleton" style={{ height: '90px' }} />
                        ))}
                    </div>
                )}

                {/* Booking Cards */}
                {!loading && bookings.map((b, i) => {
                    const schedule = b.seats?.schedules
                    const isExpired = schedule && new Date(`${schedule.departure_date}T23:59:59`) < new Date()
                    const isCancelled = b.status === 'CANCELLED'

                    let badgeClass = 'badge-pending'
                    let statusText = '⏳ Pending'
                    let accentColor = 'var(--gold)'

                    if (isCancelled) {
                        badgeClass = 'badge-cancelled'
                        statusText = '❌ Cancelled'
                        accentColor = 'var(--danger)'
                    } else if (isExpired) {
                        badgeClass = 'badge-expired'
                        statusText = '🕒 Expired'
                        accentColor = 'var(--text-muted)'
                    } else if (b.payment_status === 'PAID') {
                        badgeClass = 'badge-paid'
                        statusText = '✅ Paid'
                        accentColor = 'var(--success)'
                    }

                    const isInactive = isCancelled || isExpired

                    return (
                        <div
                            key={b.id}
                            className={`glass animate-in animate-in-delay-${Math.min(i + 1, 5)}`}
                            style={{
                                padding: '1.25rem',
                                marginBottom: '0.75rem',
                                opacity: isInactive ? 0.6 : 1,
                                borderLeft: `3px solid ${accentColor}`,
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <p style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: '1rem' }}>
                                        {b.booking_ref}
                                    </p>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
                                        Seat {b.seats?.seat_number} &nbsp;•&nbsp; {b.price_etb} ETB
                                    </p>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px' }}>
                                        {b.seat_traveller_name} &nbsp;•&nbsp; {new Date(b.booked_at).toLocaleDateString()}
                                    </p>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                                    <div className={`badge ${badgeClass}`}>
                                        {statusText}
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            onClick={() => router.push(`/ticket/${b.booking_ref}`)}
                                            className={`btn btn-sm ${isInactive ? 'btn-outline' : 'btn-outline'}`}
                                            style={{ fontSize: '0.75rem' }}
                                        >
                                            View
                                        </button>

                                        {!isCancelled && !isExpired && b.payment_status === 'PAID' && (
                                            <button
                                                onClick={() => handleCancel(b.booking_ref)}
                                                disabled={cancellingId === b.booking_ref}
                                                className="btn btn-sm btn-danger"
                                                style={{ fontSize: '0.75rem' }}
                                            >
                                                {cancellingId === b.booking_ref ? '...' : 'Cancel'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
