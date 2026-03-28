"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function TicketPage() {
    const { ref } = useParams()
    const [booking, setBooking] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadBooking() {
            const { data } = await supabase
                .from('bookings')
                .select(`
          *,
          seats ( seat_number, seat_type ),
          passengers ( full_name, phone )
        `)
                .eq('booking_ref', ref)
                .single()

            setBooking(data)
            setLoading(false)
        }
        if (ref) loadBooking()
    }, [ref])

    if (loading) return <main style={{ padding: '2rem' }}>Loading ticket...</main>
    if (!booking) return <main style={{ padding: '2rem' }}>Booking not found.</main>

    const isPaid = booking.payment_status === 'PAID'

    return (
        <main style={{ padding: '2rem', maxWidth: '500px', margin: '0 auto', fontFamily: 'system-ui', textAlign: 'center' }}>
            <h1 style={{ fontSize: '2rem' }}>🎫</h1>
            <h2>Your Ticket</h2>

            <div style={{
                background: isPaid ? '#f0fdf4' : '#fef9c3',
                border: `2px solid ${isPaid ? '#16a34a' : '#ca8a04'}`,
                borderRadius: '12px',
                padding: '2rem',
                marginTop: '1rem'
            }}>
                <p style={{ fontSize: '0.9rem', color: isPaid ? '#16a34a' : '#ca8a04', fontWeight: 'bold' }}>
                    {isPaid ? '✅ PAID' : '⏳ PAYMENT PENDING'}
                </p>

                <h3 style={{ margin: '1rem 0 0.5rem', fontSize: '1.5rem' }}>{booking.booking_ref}</h3>

                <div style={{ textAlign: 'left', marginTop: '1.5rem', lineHeight: '2' }}>
                    <p><strong>Passenger:</strong> {booking.seat_traveller_name}</p>
                    <p><strong>Phone:</strong> {booking.passengers?.phone}</p>
                    <p><strong>Seat:</strong> {booking.seats?.seat_number} ({booking.seats?.seat_type})</p>
                    <p><strong>Price:</strong> {booking.price_etb} ETB</p>
                    <p><strong>Trip:</strong> {booking.trip_type}</p>
                    <p><strong>Booked:</strong> {new Date(booking.booked_at).toLocaleString()}</p>
                    {booking.chapa_tx_ref && (
                        <p><strong>Payment Ref:</strong> {booking.chapa_tx_ref}</p>
                    )}
                </div>

            </div>

            <p style={{ marginTop: '2rem', color: '#666', fontSize: '0.9rem' }}>
                Show this ticket to the conductor when boarding.
            </p>
        </main>
    )
}
