"use client"

import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useState } from 'react'

export default function ConfirmBooking() {
    const { id } = useParams()           // schedule ID
    const searchParams = useSearchParams()
    const seat = searchParams.get('seat') // e.g. "3A"
    const price = searchParams.get('price') // e.g. "430"
    const router = useRouter()

    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [loading, setLoading] = useState(false)

    const handlePay = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!/^09\d{8}$/.test(phone)) {
            return alert('Phone must be Ethiopian format: 09XXXXXXXX (10 digits)')
        }
        setLoading(true)

        // Call your API to create the booking + get a Chapa payment URL
        const res = await fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scheduleId: id, seatNumber: seat, name, phone }),
        })

        const data = await res.json()

        if (data.checkoutUrl) {
            // Redirect the user to Chapa's payment page
            window.location.href = data.checkoutUrl
        } else {
            alert('Error: ' + data.error)
            setLoading(false)
        }
    }

    return (
        <main style={{ padding: '2rem', maxWidth: '500px', margin: '0 auto', fontFamily: 'system-ui' }}>
            <button onClick={() => router.back()} style={{ marginBottom: '1rem', cursor: 'pointer' }}>← Back</button>

            <h2>Confirm Your Booking</h2>

            <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '8px', marginBottom: '2rem' }}>
                <p><strong>Seat:</strong> {seat}</p>
                <p><strong>Price:</strong> {price} ETB</p>
            </div>

            <form onSubmit={handlePay} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input
                    placeholder="Full Name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    style={{ padding: '10px', fontSize: '1rem' }}
                />
                <input
                    placeholder="Phone Number (09...)"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    required
                    style={{ padding: '10px', fontSize: '1rem' }}
                />
                <button
                    type="submit"
                    disabled={loading}
                    style={{ padding: '12px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem' }}
                >
                    {loading ? 'Redirecting to payment...' : `Pay ${price} ETB`}
                </button>
            </form>
        </main>
    )
}
