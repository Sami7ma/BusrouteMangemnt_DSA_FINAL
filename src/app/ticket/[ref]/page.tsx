"use client"

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function TicketPage() {
    const { ref } = useParams()
    const router = useRouter()
    const [bookings, setBookings] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [verifying, setVerifying] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [countdown, setCountdown] = useState<string | null>(null)
    const [timerExpired, setTimerExpired] = useState(false)
    const qrRef = useRef<HTMLCanvasElement>(null)

    async function loadBooking() {
        try {
            const res = await fetch(`/api/bookings/ticket?ref=${ref}`)
            if (!res.ok) {
                setError('Booking not found')
                setLoading(false)
                return
            }
            const data = await res.json()
            if (data.error) {
                setError(data.error)
            } else {
                setBookings(Array.isArray(data) ? data : [data])
            }
        } catch {
            setError('Failed to load ticket')
        }
        setLoading(false)
    }

    useEffect(() => {
        if (ref) loadBooking()
    }, [ref])

    // 15-minute countdown timer for PENDING bookings
    useEffect(() => {
        if (bookings.length === 0) return
        const primary = bookings[0]
        if (primary.payment_status === 'PAID' || primary.status === 'CANCELLED') return

        const bookedAt = new Date(primary.booked_at).getTime()
        const deadline = bookedAt + 15 * 60 * 1000 // 15 minutes

        const tick = () => {
            const now = Date.now()
            const remaining = deadline - now

            if (remaining <= 0) {
                setCountdown('00:00')
                setTimerExpired(true)
                // Auto-release seats
                fetch('/api/cron/release-seats').then(() => {
                    setTimeout(() => loadBooking(), 1500)
                })
                return
            }

            const mins = Math.floor(remaining / 60000)
            const secs = Math.floor((remaining % 60000) / 1000)
            setCountdown(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`)
        }

        tick()
        const interval = setInterval(tick, 1000)
        return () => clearInterval(interval)
    }, [bookings])

    // Generate QR code as simple SVG-based data matrix
    useEffect(() => {
        if (!qrRef.current || bookings.length === 0) return
        const canvas = qrRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const data = `BEMENGEDE:${ref}:${bookings.map(b => b.seats?.seat_number).join(',')}`
        const size = 140
        canvas.width = size
        canvas.height = size

        // Simple visual QR placeholder — generate a unique pattern from the booking ref
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, size, size)
        ctx.fillStyle = '#000000'

        // Position patterns (corners)
        const drawFinder = (x: number, y: number) => {
            ctx.fillRect(x, y, 28, 28)
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(x + 4, y + 4, 20, 20)
            ctx.fillStyle = '#000000'
            ctx.fillRect(x + 8, y + 8, 12, 12)
        }
        drawFinder(4, 4)
        drawFinder(size - 32, 4)
        drawFinder(4, size - 32)

        // Data modules from booking ref hash
        const str = String(ref) + bookings[0]?.id
        for (let i = 0; i < str.length; i++) {
            const code = str.charCodeAt(i)
            const x = 36 + (i % 8) * 10
            const y = 36 + Math.floor(i / 8) * 10
            if (x < size - 4 && y < size - 4) {
                ctx.fillStyle = code % 2 === 0 ? '#000000' : '#ffffff'
                ctx.fillRect(x, y, 8, 8)
            }
        }
    }, [bookings, ref])

    const handleVerify = async () => {
        setVerifying(true)
        const res = await fetch(`/api/bookings/verify?ref=${ref}`)
        const data = await res.json()
        if (data.status === 'paid' || data.status === 'already_paid') {
            alert('✅ Payment confirmed!')
            await loadBooking()
        } else {
            alert('⏳ Payment not yet received. Try again in a moment.')
        }
        setVerifying(false)
    }

    if (loading) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="skeleton" style={{ width: '350px', height: '500px' }} />
        </div>
    )

    if (error || bookings.length === 0) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '3rem' }}>🔍</p>
            <h2>Booking not found</h2>
            <p style={{ color: 'var(--text-muted)' }}>Check your booking reference and try again.</p>
            <button className="btn btn-outline" onClick={() => router.push('/')}>← Go Home</button>
        </div>
    )

    // Use first booking for shared info
    const primary = bookings[0]
    const isPaid = bookings.every(b => b.payment_status === 'PAID')
    const isCancelled = bookings.every(b => b.status === 'CANCELLED')
    const schedule = primary.seats?.schedules
    const route = schedule?.routes
    const isExpired = schedule && new Date(`${schedule.departure_date}T23:59:59`) < new Date()
    const allSeats = bookings.map(b => b.seats?.seat_number).filter(Boolean)
    const totalPrice = bookings.reduce((sum, b) => sum + Number(b.price_etb || 0), 0)

    let badgeClass = 'badge-pending'
    let statusText = '⏳ Payment Pending'
    let accentColor = 'var(--gold)'

    if (isCancelled) {
        badgeClass = 'badge-cancelled'
        statusText = '❌ Cancelled'
        accentColor = 'var(--danger)'
    } else if (isExpired) {
        badgeClass = 'badge-expired'
        statusText = '🕒 Expired'
        accentColor = 'var(--text-muted)'
    } else if (isPaid) {
        badgeClass = 'badge-paid'
        statusText = '✅ Paid'
        accentColor = 'var(--success)'
    }

    const infoRows = [
        { label: 'Passenger', value: primary.seat_traveller_name },
        { label: 'Phone', value: primary.passengers?.phone_masked || '—' },
        { label: 'Route', value: route ? `${route.origin?.name} → ${route.destination?.name}` : '—' },
        { label: 'Date', value: schedule?.departure_date || '—' },
        { label: 'Time', value: `${schedule?.departure_time || '—'} → ${schedule?.arrival_time || 'TBD'}` },
        { label: 'Seat(s)', value: allSeats.join(', ') || '—' },
        { label: 'Total', value: `${totalPrice} ETB${bookings.length > 1 ? ` (${bookings.length} seats)` : ''}` },
        { label: 'Trip', value: primary.trip_type },
        { label: 'Booked', value: new Date(primary.booked_at).toLocaleString() },
    ]

    if (primary.chapa_tx_ref) {
        infoRows.push({ label: 'Payment Ref', value: primary.chapa_tx_ref })
    }

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem' }}>
            <div style={{ width: '100%', maxWidth: '420px' }}>
                {/* Back */}
                <button className="back-btn animate-in" onClick={() => router.push('/')} style={{ marginBottom: '1.5rem' }}>
                    ← Home
                </button>

                {/* Ticket Card */}
                <div className="glass animate-in animate-in-delay-1" style={{
                    padding: '2rem',
                    textAlign: 'center',
                    opacity: isCancelled || isExpired ? 0.75 : 1,
                    borderColor: accentColor,
                }}>
                    {/* Header */}
                    <p style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: '0.85rem', color: 'var(--gold)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                        BEMENGEDE
                    </p>

                    <div className={`badge ${badgeClass}`} style={{ marginBottom: '1rem' }}>
                        {statusText}
                    </div>

                    <h2 style={{
                        fontSize: '1.6rem',
                        marginBottom: '0.25rem',
                        textDecoration: isCancelled ? 'line-through' : 'none',
                        color: isCancelled ? 'var(--text-muted)' : 'var(--text)',
                    }}>
                        {ref}
                    </h2>

                    {bookings.length > 1 && (
                        <p style={{ color: 'var(--gold)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                            Group booking · {bookings.length} seats
                        </p>
                    )}

                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                        {isCancelled || isExpired ? 'Receipt' : 'Ticket'}
                    </p>

                    {/* QR Code */}
                    {isPaid && !isCancelled && !isExpired && (
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                            <div style={{
                                background: 'white',
                                borderRadius: 12,
                                padding: 10,
                                display: 'inline-block',
                            }}>
                                <canvas ref={qrRef} style={{ width: 120, height: 120, display: 'block' }} />
                            </div>
                        </div>
                    )}

                    {/* Tear line */}
                    <div className="ticket-tear" style={{ margin: '0 -2rem', marginBottom: '1.5rem' }}>
                        <div className="ticket-tear-line" />
                    </div>

                    {/* Info rows */}
                    <div style={{ textAlign: 'left' }}>
                        {infoRows.map((row, i) => (
                            <div key={row.label} className={`animate-in animate-in-delay-${Math.min(i + 2, 5)}`} style={{
                                display: 'flex', justifyContent: 'space-between',
                                padding: '10px 0',
                                borderBottom: i < infoRows.length - 1 ? '1px solid var(--card-border)' : 'none',
                            }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{row.label}</span>
                                <span style={{ fontWeight: 500, fontSize: '0.9rem', textAlign: 'right', maxWidth: '60%' }}>{row.value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Verify Button */}
                {!isPaid && !isCancelled && !isExpired && (
                    <button
                        onClick={handleVerify}
                        disabled={verifying}
                        className="btn btn-gold btn-full animate-in animate-in-delay-4"
                        style={{ marginTop: '1rem' }}
                    >
                        {verifying ? 'Checking with Chapa...' : '🔄 Verify Payment'}
                    </button>
                )}

                {/* Boarding message */}
                {isPaid && !isCancelled && !isExpired && (
                    <p className="animate-in animate-in-delay-5" style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Show this ticket {bookings.length > 1 ? `(${allSeats.join(', ')})` : ''} to the conductor when boarding.
                    </p>
                )}
            </div>
        </div>
    )
}
