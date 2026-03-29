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
    const isCancelled = booking.status === 'CANCELLED'
    
    // Check if the trip is in the past (expires at end of departure date)
    const schedule = booking.seats?.schedules
    const isExpired = schedule && new Date(`${schedule.departure_date}T23:59:59`) < new Date()

    let boxColor = '#fef9c3'
    let borderColor = '#ca8a04'
    let statusTextColor = '#ca8a04'
    let statusText = '⏳ PAYMENT PENDING'

    if (isCancelled) {
        boxColor = '#fef2f2'
        borderColor = '#dc2626'
        statusTextColor = '#dc2626'
        statusText = '❌ CANCELLED'
    } else if (isExpired) {
        boxColor = '#f3f4f6'
        borderColor = '#6b7280'
        statusTextColor = '#6b7280'
        statusText = '🕒 EXPIRED'
    } else if (isPaid) {
        boxColor = '#f0fdf4'
        borderColor = '#16a34a'
        statusTextColor = '#16a34a'
        statusText = '✅ PAID'
    }

    return (
        <main style={{ padding: '2rem', maxWidth: '500px', margin: '0 auto', fontFamily: 'system-ui', textAlign: 'center' }}>
            <h1 style={{ fontSize: '2rem' }}>🎫</h1>
            <h2>{isCancelled || isExpired ? 'Ticket Receipt' : 'Your Ticket'}</h2>

            <div style={{
                background: boxColor,
                border: `2px solid ${borderColor}`,
                borderRadius: '12px',
                padding: '2rem',
                marginTop: '1rem',
                opacity: isCancelled || isExpired ? 0.8 : 1
            }}>
                <p style={{ fontSize: '1.2rem', color: statusTextColor, fontWeight: 'bold' }}>
                    {statusText}
                </p>

                <h3 style={{ margin: '1rem 0 0.5rem', fontSize: '1.5rem', textDecoration: isCancelled ? 'line-through' : 'none' }}>
                    {booking.booking_ref}
                </h3>

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

            {!isCancelled && !isExpired && (
                <p style={{ marginTop: '2rem', color: '#666', fontSize: '0.9rem' }}>
                    Show this ticket to the conductor when boarding.
                </p>
            )}
        </main>
    )
}
