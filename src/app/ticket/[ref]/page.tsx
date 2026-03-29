"use client"

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function TicketPage() {
    const { ref } = useParams()
    const router = useRouter()
    const [booking, setBooking] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [verifying, setVerifying] = useState(false)
    const [pollCount, setPollCount] = useState(0)

    const fetchBooking = useCallback(async () => {
        // Use our server-side API (bypasses RLS, also verifies with Chapa if PENDING)
        const res = await fetch(`/api/bookings/status?ref=${ref}`)
        if (!res.ok) { setLoading(false); return }
        const data = await res.json()
        setBooking(data)
        setLoading(false)
        return data
    }, [ref])

    useEffect(() => {
        if (!ref) return
        fetchBooking()
    }, [ref, fetchBooking])

    // Auto-poll every 3 seconds if booking is PENDING (up to 10 tries = 30 seconds)
    useEffect(() => {
        if (!booking || booking.payment_status !== 'PENDING' || pollCount >= 10) return

        setVerifying(true)
        const timer = setTimeout(async () => {
            const data = await fetchBooking()
            setPollCount(c => c + 1)
            if (data?.payment_status !== 'PENDING') setVerifying(false)
        }, 3000)

        return () => clearTimeout(timer)
    }, [booking, pollCount, fetchBooking])

    if (loading) return (
        <main style={{ padding: '2rem', maxWidth: '500px', margin: '0 auto', fontFamily: 'system-ui', textAlign: 'center' }}>
            <p>Loading ticket...</p>
        </main>
    )

    if (!booking || booking.error) return (
        <main style={{ padding: '2rem', maxWidth: '500px', margin: '0 auto', fontFamily: 'system-ui', textAlign: 'center' }}>
            <p>Booking not found. <button onClick={() => router.push('/')} style={{ cursor: 'pointer', color: '#2563eb', background: 'none', border: 'none', textDecoration: 'underline' }}>Go home</button></p>
        </main>
    )

    const isCancelled = booking.status === 'CANCELLED'
    const isPaid = booking.payment_status === 'PAID'
    const isPending = booking.payment_status === 'PENDING' && !isCancelled

    const statusColor = isCancelled ? '#dc2626' : isPaid ? '#16a34a' : '#ca8a04'
    const statusBg = isCancelled ? '#fef2f2' : isPaid ? '#f0fdf4' : '#fef9c3'
    const statusBorder = isCancelled ? '#dc2626' : isPaid ? '#16a34a' : '#ca8a04'
    const statusText = isCancelled ? '❌ CANCELLED' : isPaid ? '✅ CONFIRMED & PAID' : '⏳ PAYMENT PENDING'

    return (
        <main style={{ padding: '2rem', maxWidth: '500px', margin: '0 auto', fontFamily: 'system-ui' }}>
            <button onClick={() => router.push('/my-bookings')} style={{ marginBottom: '1.5rem', cursor: 'pointer', background: 'none', border: '1px solid #ddd', padding: '6px 14px', borderRadius: '4px' }}>
                ← My Bookings
            </button>

            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <div style={{ fontSize: '3rem' }}>{isCancelled ? '🚫' : isPaid ? '🎫' : '⏳'}</div>
                <h2 style={{ margin: '0.5rem 0 0' }}>
                    {isCancelled ? 'Booking Cancelled' : isPaid ? 'Your Ticket' : 'Payment Pending'}
                </h2>
            </div>

            {/* Status banner */}
            <div style={{ background: statusBg, border: `2px solid ${statusBorder}`, borderRadius: '12px', padding: '1.5rem', marginBottom: '1rem' }}>
                <p style={{ color: statusColor, fontWeight: 'bold', margin: '0 0 1rem', fontSize: '1rem', textAlign: 'center' }}>
                    {statusText}
                </p>

                <h3 style={{ margin: '0 0 1rem', fontSize: '1.4rem', textAlign: 'center', letterSpacing: '1px', fontFamily: 'monospace' }}>
                    {booking.booking_ref}
                </h3>

                <hr style={{ border: 'none', borderTop: `1px dashed ${statusBorder}`, margin: '1rem 0' }} />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.95rem' }}>
                    <div>
                        <p style={{ color: '#888', margin: '0 0 0.15rem', fontSize: '0.75rem', textTransform: 'uppercase' }}>Passenger</p>
                        <p style={{ margin: 0, fontWeight: '600' }}>{booking.seat_traveller_name}</p>
                    </div>
                    <div>
                        <p style={{ color: '#888', margin: '0 0 0.15rem', fontSize: '0.75rem', textTransform: 'uppercase' }}>Phone</p>
                        <p style={{ margin: 0, fontWeight: '600' }}>{booking.passengers?.phone}</p>
                    </div>
                    <div>
                        <p style={{ color: '#888', margin: '0 0 0.15rem', fontSize: '0.75rem', textTransform: 'uppercase' }}>Seat</p>
                        <p style={{ margin: 0, fontWeight: '600' }}>{booking.seats?.seat_number} <span style={{ color: '#888', fontWeight: 'normal', fontSize: '0.85rem' }}>({booking.seats?.seat_type})</span></p>
                    </div>
                    <div>
                        <p style={{ color: '#888', margin: '0 0 0.15rem', fontSize: '0.75rem', textTransform: 'uppercase' }}>Price</p>
                        <p style={{ margin: 0, fontWeight: '600' }}>{booking.price_etb} ETB</p>
                    </div>
                    <div>
                        <p style={{ color: '#888', margin: '0 0 0.15rem', fontSize: '0.75rem', textTransform: 'uppercase' }}>Trip Type</p>
                        <p style={{ margin: 0, fontWeight: '600' }}>{booking.trip_type === 'ONE_WAY' ? 'One Way' : 'Round Trip'}</p>
                    </div>
                    <div>
                        <p style={{ color: '#888', margin: '0 0 0.15rem', fontSize: '0.75rem', textTransform: 'uppercase' }}>Booked On</p>
                        <p style={{ margin: 0, fontWeight: '600' }}>{new Date(booking.booked_at).toLocaleDateString()}</p>
                    </div>
                </div>

                {booking.chapa_tx_ref && (
                    <>
                        <hr style={{ border: 'none', borderTop: `1px dashed ${statusBorder}`, margin: '1rem 0' }} />
                        <div>
                            <p style={{ color: '#888', margin: '0 0 0.15rem', fontSize: '0.75rem', textTransform: 'uppercase' }}>Chapa Payment Ref</p>
                            <p style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.85rem' }}>{booking.chapa_tx_ref}</p>
                        </div>
                    </>
                )}

                {isCancelled && booking.cancelled_at && (
                    <>
                        <hr style={{ border: 'none', borderTop: '1px dashed #dc2626', margin: '1rem 0' }} />
                        <p style={{ color: '#dc2626', margin: 0, fontSize: '0.85rem', textAlign: 'center' }}>
                            Cancelled on {new Date(booking.cancelled_at).toLocaleString()}
                        </p>
                    </>
                )}
            </div>

            {/* Verifying payment message */}
            {verifying && isPending && (
                <p style={{ textAlign: 'center', color: '#ca8a04', fontSize: '0.9rem', margin: '0.5rem 0' }}>
                    ⏳ Verifying your payment... please wait
                </p>
            )}

            {/* Timed out still pending */}
            {!verifying && isPending && pollCount >= 10 && (
                <div style={{ background: '#fef2f2', border: '1px solid #dc2626', borderRadius: '8px', padding: '1rem', textAlign: 'center', marginTop: '0.5rem' }}>
                    <p style={{ color: '#dc2626', margin: '0 0 0.5rem', fontWeight: 'bold' }}>Payment not confirmed yet</p>
                    <p style={{ color: '#666', margin: '0 0 1rem', fontSize: '0.85rem' }}>If you paid on Chapa, it may take a moment. Check back shortly.</p>
                    <button onClick={() => { setPollCount(0); setVerifying(true) }}
                        style={{ padding: '8px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        Check Again
                    </button>
                </div>
            )}

            {/* Footer note */}
            {isPaid && (
                <p style={{ textAlign: 'center', color: '#666', fontSize: '0.85rem', marginTop: '1.5rem' }}>
                    Show this ticket to the conductor when boarding.
                </p>
            )}

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => router.push('/')}
                    style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}>
                    🏠 Home
                </button>
                <button onClick={() => router.push('/my-bookings')}
                    style={{ flex: 1, padding: '10px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    📋 My Bookings
                </button>
            </div>
        </main>
    )
}
