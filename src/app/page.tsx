"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  // State for our form and data
  const [cities, setCities] = useState<{ id: string, name: string }[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [date, setDate] = useState('')
  const [tripType, setTripType] = useState('ONE_WAY')

  // Fetch cities when the page loads
  useEffect(() => {
    async function fetchCities() {
      try {
        const res = await fetch('/api/cities')
        const data = await res.json()
        if (Array.isArray(data)) setCities(data)
      } catch (err) {
        console.error('Failed to load cities:', err)
      }
    }
    fetchCities()
  }, [])

  // Handle the search button click
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault() // Prevents the page from refreshing
    if (!from || !to || !date) return alert("Please fill all fields")
    if (from === to) return alert("Origin and destination cannot be the same")

    // Redirect to the search results page with our selections in the URL
    router.push(`/search?from=${from}&to=${to}&date=${date}&type=${tripType}`)
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1>🚌 Book a Ticket</h1>

      <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>

        {/* Trip Type Toggle */}
        <div>
          <label>
            <input type="radio" checked={tripType === 'ONE_WAY'} onChange={() => setTripType('ONE_WAY')} />
            One Way
          </label>
          <label style={{ marginLeft: '1rem' }}>
            <input type="radio" checked={tripType === 'ROUND_TRIP'} onChange={() => setTripType('ROUND_TRIP')} />
            Round Trip
          </label>
        </div>

        {/* Origin */}
        <select value={from} onChange={(e) => setFrom(e.target.value)} required style={{ padding: '10px' }}>
          <option value="">Leaving from...</option>
          {cities.map(city => (
            <option key={city.id} value={city.name}>{city.name}</option>
          ))}
        </select>

        {/* Destination */}
        <select value={to} onChange={(e) => setTo(e.target.value)} required style={{ padding: '10px' }}>
          <option value="">Going to...</option>
          {cities.map(city => (
            <option key={city.id} value={city.name}>{city.name}</option>
          ))}
        </select>

        {/* Date */}
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          style={{ padding: '10px' }}
        />

        <button type="submit" style={{ padding: '12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Search Buses
        </button>
      </form>
      <button
        onClick={() => router.push('/my-bookings')}
        style={{ marginTop: '1rem', padding: '10px', background: 'transparent', border: '1px solid #666', borderRadius: '4px', cursor: 'pointer', width: '100%' }}
      >
        📋 My Bookings
      </button>

    </main>
  )
}
