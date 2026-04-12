"use client"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function TicketPage() {
    const { ref } = useParams()
    const router = useRouter()
    const [booking, setBooking] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [verifying, setVerifying] = useState(false)

    async function loadBooking() {
        const { data } = await supabase
            .from('bookings')
            .select(`
              *,
              seats ( seat_number, seat_type, schedules(departure_date, departure_time) ),
              passengers ( full_name, phone )
            `)
            .eq('booking_ref', ref)
            .single()
        setBooking(data)
        setLoading(false)
    }

    useEffect(() => {
        if (ref) loadBooking()
    }, [ref])

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

    if (!booking) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '3rem' }}>🔍</p>
            <h2>Booking not found</h2>
            <p style={{ color: 'var(--text-muted)' }}>Check your booking reference and try again.</p>
            <button className="btn btn-outline" onClick={() => router.push('/')}>← Go Home</button>
        </div>
    )

    const isPaid = booking.payment_status === 'PAID'
    const isCancelled = booking.status === 'CANCELLED'
    const schedule = booking.seats?.schedules
    const isExpired = schedule && new Date(`${schedule.departure_date}T23:59:59`) < new Date()

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
        { label: 'Passenger', value: booking.seat_traveller_name },
        { label: 'Phone', value: booking.passengers?.phone },
        { label: 'Seat', value: `${booking.seats?.seat_number} (${booking.seats?.seat_type})` },
        { label: 'Price', value: `${booking.price_etb} ETB` },
        { label: 'Trip', value: booking.trip_type },
        { label: 'Booked', value: new Date(booking.booked_at).toLocaleString() },
    ]

    if (booking.chapa_tx_ref) {
        infoRows.push({ label: 'Payment Ref', value: booking.chapa_tx_ref })
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
                        {booking.booking_ref}
                    </h2>

                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                        {isCancelled || isExpired ? 'Receipt' : 'Ticket'}
                    </p>

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
                                <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{row.value}</span>
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
                        Show this ticket to the conductor when boarding.
                    </p>
                )}
            </div>
        </div>
    )
}
