"use client"

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Step = 'results' | 'seats' | 'confirm'

export default function BookingFlow() {
    const searchParams = useSearchParams()
    const router = useRouter()

    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const date = searchParams.get('date')

    const [step, setStep] = useState<Step>('results')
    const [transitioning, setTransitioning] = useState(false)

    // Step 1: Results
    const [schedules, setSchedules] = useState<any[]>([])
    const [loadingResults, setLoadingResults] = useState(true)

    // Step 2: Seats
    const [selectedSchedule, setSelectedSchedule] = useState<any>(null)
    const [seats, setSeats] = useState<any[]>([])
    const [selectedSeat, setSelectedSeat] = useState<string | null>(null)
    const [loadingSeats, setLoadingSeats] = useState(false)

    // Step 3: Confirm
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [paying, setPaying] = useState(false)

    // ─── Step transition helper ────────────────────────────────
    const goToStep = (newStep: Step) => {
        setTransitioning(true)
        setTimeout(() => {
            setStep(newStep)
            setTransitioning(false)
            window.scrollTo({ top: 0, behavior: 'smooth' })
        }, 300)
    }

    // ─── Step 1: Load schedules ────────────────────────────────
    useEffect(() => {
        async function fetchSchedules() {
            if (!from || !to || !date) return
            const res = await fetch(`/api/routes/search?from=${from}&to=${to}&date=${date}&type=ONE_WAY`)
            const data = await res.json()
            setSchedules(data)
            setLoadingResults(false)
        }
        fetchSchedules()
    }, [from, to, date])

    // ─── Step 2: Load seats for selected schedule ──────────────
    const handleSelectSchedule = async (schedule: any) => {
        setSelectedSchedule(schedule)
        setLoadingSeats(true)
        setSelectedSeat(null)
        goToStep('seats')

        const { data: seatData } = await supabase
            .from('seats')
            .select('*')
            .eq('schedule_id', schedule.id)
            .order('seat_number')

        setSeats(seatData || [])
        setLoadingSeats(false)

        // Realtime subscription
        const channel = supabase
            .channel('seats_changes_' + schedule.id)
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'seats', filter: `schedule_id=eq.${schedule.id}` },
                (payload) => {
                    setSeats(curr => curr.map(s => s.id === payload.new.id ? { ...s, is_booked: payload.new.is_booked } : s))
                })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }

    // ─── Step 3: Pay ───────────────────────────────────────────
    const handlePay = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!/^09\d{8}$/.test(phone)) return alert('Phone must be: 09XXXXXXXX (10 digits)')
        setPaying(true)

        const res = await fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scheduleId: selectedSchedule.id,
                seatNumber: selectedSeat,
                name,
                phone
            }),
        })
        const data = await res.json()

        if (data.checkoutUrl) {
            window.location.href = data.checkoutUrl
        } else {
            alert('Error: ' + data.error)
            setPaying(false)
        }
    }

    // ─── Progress bar ──────────────────────────────────────────
    const steps: { key: Step; label: string; num: number }[] = [
        { key: 'results', label: 'Select Bus', num: 1 },
        { key: 'seats', label: 'Pick Seat', num: 2 },
        { key: 'confirm', label: 'Pay', num: 3 },
    ]
    const currentIdx = steps.findIndex(s => s.key === step)

    // ─── Seat grid helpers ─────────────────────────────────────
    const rows = Array.from(new Set(seats.map(s => s.seat_number.match(/\d+/)?.[0])))
        .sort((a, b) => parseInt(a!) - parseInt(b!))

    const price = selectedSchedule?.routes?.base_price_etb ?? 0

    return (
        <div style={{ minHeight: '100vh', background: 'var(--navy)' }}>
            {/* Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--card-border)' }}>
                <div className="container-wide" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button className="back-btn" onClick={() => {
                        if (step === 'confirm') goToStep('seats')
                        else if (step === 'seats') goToStep('results')
                        else router.push('/')
                    }}>
                        ← Back
                    </button>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }}>
                            {from} → {to}
                        </p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{date}</p>
                    </div>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="container-wide">
                <div className="progress-bar">
                    {steps.map((s, i) => (
                        <div key={s.key} style={{ display: 'contents' }}>
                            <div className={`progress-step ${i < currentIdx ? 'done' : i === currentIdx ? 'active' : ''}`}>
                                <div className="step-num">
                                    {i < currentIdx ? '✓' : s.num}
                                </div>
                                <span>{s.label}</span>
                            </div>
                            {i < steps.length - 1 && (
                                <div className={`progress-line ${i < currentIdx ? 'filled' : ''}`} />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Step Content */}
            <div className="container-wide" style={{ paddingBottom: '4rem' }}>
                <div style={{ opacity: transitioning ? 0 : 1, transform: transitioning ? 'translateY(-20px)' : 'translateY(0)', transition: 'all 0.3s ease' }}>

                    {/* ═══════════ STEP 1: RESULTS ═══════════ */}
                    {step === 'results' && (
                        <div className="step">
                            <h2 className="animate-in" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                                Available Buses
                            </h2>
                            <p className="animate-in animate-in-delay-1" style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                                {schedules.length > 0 ? `${schedules.length} bus${schedules.length > 1 ? 'es' : ''} found` : ''}
                            </p>

                            {loadingResults ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="skeleton" style={{ height: '100px' }} />
                                    ))}
                                </div>
                            ) : schedules.length === 0 ? (
                                <div className="glass animate-in" style={{ padding: '3rem', textAlign: 'center' }}>
                                    <p style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🚌</p>
                                    <h3 style={{ marginBottom: '0.5rem' }}>No buses found</h3>
                                    <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Try a different date or route.</p>
                                    <button className="btn btn-outline" onClick={() => router.push('/')}>
                                        ← Search Again
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {schedules.map((schedule, i) => (
                                        <div
                                            key={schedule.id}
                                            className={`glass glass-hover animate-in animate-in-delay-${Math.min(i + 1, 5)}`}
                                            onClick={() => handleSelectSchedule(schedule)}
                                            style={{ padding: '1.25rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                        >
                                            <div>
                                                <p style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: '1.15rem' }}>
                                                    🕐 {schedule.departure_time}
                                                    <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.85rem' }}> → {schedule.arrival_time || 'TBD'}</span>
                                                </p>
                                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
                                                    🚌 {schedule.buses.plate_number} &nbsp;•&nbsp; {schedule.routes.distance_km} km
                                                </p>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <p style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '1.4rem', color: 'var(--gold)' }}>
                                                    {schedule.routes.base_price_etb}
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}> ETB</span>
                                                </p>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--emerald)' }}>Select →</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ═══════════ STEP 2: SEATS ═══════════ */}
                    {step === 'seats' && (
                        <div className="step">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                <div className="animate-in">
                                    <h2 style={{ fontSize: '1.5rem' }}>Pick Your Seat</h2>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                                        🕐 {selectedSchedule?.departure_time} &nbsp;•&nbsp; 🚌 {selectedSchedule?.buses?.plate_number}
                                    </p>
                                </div>
                                <div className="animate-in animate-in-delay-1" style={{ textAlign: 'right' }}>
                                    <p style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '1.3rem', color: 'var(--gold)' }}>
                                        {price} ETB
                                    </p>
                                </div>
                            </div>

                            {loadingSeats ? (
                                <div className="skeleton" style={{ height: '400px' }} />
                            ) : (
                                <>
                                    {/* Seat Legend */}
                                    <div className="animate-in animate-in-delay-1" style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', fontSize: '0.8rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: '2px solid var(--card-border)', background: 'rgba(255,255,255,0.04)' }} />
                                            <span style={{ color: 'var(--text-muted)' }}>Available</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: '2px solid var(--gold)', background: 'rgba(245,158,11,0.2)' }} />
                                            <span style={{ color: 'var(--text-muted)' }}>Selected</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: '2px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.15)' }} />
                                            <span style={{ color: 'var(--text-muted)' }}>Booked</span>
                                        </div>
                                    </div>

                                    {/* Bus-shaped seat grid */}
                                    <div className="seat-grid-wrapper animate-in animate-in-delay-2">
                                        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600 }}>
                                                🪟 Front of Bus
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                            {rows.map((rowNum) => {
                                                const rowSeats = seats.filter(s => s.seat_number.match(/\d+/)?.[0] === rowNum)
                                                return (
                                                    <div key={rowNum} style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                        {rowSeats.map((seat, index) => {
                                                            const isSelected = selectedSeat === seat.seat_number
                                                            const isBooked = seat.is_booked
                                                            return (
                                                                <div key={seat.id} style={{ display: 'flex', alignItems: 'center' }}>
                                                                    <button
                                                                        disabled={isBooked}
                                                                        onClick={() => setSelectedSeat(seat.seat_number)}
                                                                        className={`seat ${isSelected ? 'seat-selected' : ''} ${isBooked ? 'seat-booked' : ''}`}
                                                                    >
                                                                        {seat.seat_number}
                                                                    </button>
                                                                    {index === 1 && <div style={{ width: '32px' }} />}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {/* Continue Button */}
                                    <div className="animate-in animate-in-delay-3" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <p style={{ fontFamily: 'Outfit', fontWeight: 600 }}>
                                            {selectedSeat ? (
                                                <span>Seat <span style={{ color: 'var(--gold)' }}>{selectedSeat}</span></span>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)' }}>Tap a seat to select it</span>
                                            )}
                                        </p>
                                        <button
                                            disabled={!selectedSeat}
                                            onClick={() => goToStep('confirm')}
                                            className="btn btn-gold"
                                        >
                                            Continue →
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* ═══════════ STEP 3: CONFIRM ═══════════ */}
                    {step === 'confirm' && (
                        <div className="step">
                            <h2 className="animate-in" style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>
                                Confirm & Pay
                            </h2>

                            {/* Trip Summary */}
                            <div className="glass animate-in animate-in-delay-1" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <p style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: '1.1rem' }}>
                                            {from} → {to}
                                        </p>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
                                            {date} &nbsp;•&nbsp; {selectedSchedule?.departure_time} &nbsp;•&nbsp; Seat {selectedSeat}
                                        </p>
                                    </div>
                                    <p style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '1.4rem', color: 'var(--gold)' }}>
                                        {price} <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>ETB</span>
                                    </p>
                                </div>
                            </div>

                            {/* Passenger Form */}
                            <form onSubmit={handlePay} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div className="animate-in animate-in-delay-2">
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px', display: 'block', fontWeight: 500 }}>
                                        Full Name
                                    </label>
                                    <input
                                        className="input"
                                        placeholder="e.g. Abebe Kebede"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="animate-in animate-in-delay-3">
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px', display: 'block', fontWeight: 500 }}>
                                        Phone Number
                                    </label>
                                    <input
                                        className="input"
                                        placeholder="09XXXXXXXX"
                                        value={phone}
                                        onChange={e => setPhone(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="animate-in animate-in-delay-4" style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '12px 16px', borderRadius: 'var(--radius-sm)',
                                    background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)'
                                }}>
                                    <span>⚠️</span>
                                    <p style={{ color: 'var(--gold)', fontSize: '0.8rem' }}>
                                        Complete payment promptly. Unpaid seats may be released.
                                    </p>
                                </div>

                                <button
                                    type="submit"
                                    disabled={paying}
                                    className="btn btn-emerald btn-full animate-in animate-in-delay-5"
                                    style={{ marginTop: '0.5rem', fontSize: '1.05rem' }}
                                >
                                    {paying ? 'Redirecting to Chapa...' : `💳 Pay ${price} ETB`}
                                </button>
                            </form>
                        </div>
                    )}

                </div>
            </div>
        </div>
    )
}
