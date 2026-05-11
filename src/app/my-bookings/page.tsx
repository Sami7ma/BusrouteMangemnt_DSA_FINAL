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

        // Group bookings by group_ref for display
        const grouped: Record<string, any[]> = {}
        const singles: any[] = []

        if (Array.isArray(data)) {
            data.forEach((b: any) => {
                if (b.group_ref) {
                    if (!grouped[b.group_ref]) grouped[b.group_ref] = []
                    grouped[b.group_ref].push(b)
                } else {
                    singles.push(b)
                }
            })
        }

        // Merge groups into display items
        const displayItems: any[] = []
        Object.entries(grouped).forEach(([groupRef, items]) => {
            displayItems.push({
                ...items[0],
                _isGroup: true,
                _groupRef: groupRef,
                _groupItems: items,
                _allSeats: items.map(i => i.seats?.seat_number).filter(Boolean),
                _totalPrice: items.reduce((s, i) => s + Number(i.price_etb || 0), 0),
            })
        })
        singles.forEach(s => {
            displayItems.push({
                ...s,
                _isGroup: false,
                _allSeats: [s.seats?.seat_number].filter(Boolean),
                _totalPrice: Number(s.price_etb || 0),
            })
        })

        // Sort by booked_at desc
        displayItems.sort((a, b) => new Date(b.booked_at).getTime() - new Date(a.booked_at).getTime())
        setBookings(displayItems)
        setLoading(false)
    }

    const handleCancel = async (ref: string) => {
        if (!confirm('Are you sure you want to cancel this booking?')) return
        setCancellingId(ref)

        const res = await fetch('/api/bookings/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingRef: ref, phone }),
        })
        const data = await res.json()

        if (data.success) {
            const seatText = data.cancelledCount > 1 ? `${data.cancelledCount} seats` : '1 seat'
            alert(`Cancelled ${seatText}!\n${data.refundMessage}\nRefund: ${data.refundAmount} ETB`)
            // Refresh
            const refreshRes = await fetch(`/api/bookings/lookup?phone=${phone}`)
            const refreshData = await refreshRes.json()
            // Re-process groups
            handleLookup({ preventDefault: () => {} } as any)
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
                    const isCancelled = b._isGroup
                        ? b._groupItems.every((g: any) => g.status === 'CANCELLED')
                        : b.status === 'CANCELLED'

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
                    const displayRef = b._isGroup ? b._groupRef : b.booking_ref
                    const cancelRef = b._isGroup ? b._groupRef : b.booking_ref
                    const viewRef = b._isGroup ? b._groupRef : b.booking_ref

                    return (
                        <div
                            key={displayRef + '-' + i}
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
                                        {displayRef}
                                    </p>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
                                        {b._isGroup
                                            ? `Seats ${b._allSeats.join(', ')} · ${b._totalPrice} ETB`
                                            : `Seat ${b.seats?.seat_number} · ${b.price_etb} ETB`
                                        }
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
                                            onClick={() => router.push(`/ticket/${viewRef}`)}
                                            className="btn btn-sm btn-outline"
                                            style={{ fontSize: '0.75rem' }}
                                        >
                                            View
                                        </button>

                                        {!isCancelled && !isExpired && (
                                            <button
                                                onClick={() => handleCancel(cancelRef)}
                                                disabled={cancellingId === cancelRef}
                                                className="btn btn-sm btn-danger"
                                                style={{ fontSize: '0.75rem' }}
                                            >
                                                {cancellingId === cancelRef ? '...' : 'Cancel'}
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
