"use client"

import { useEffect, useState, useCallback } from 'react'
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
    const [direction, setDirection] = useState<'forward' | 'back'>('forward')
    const [animKey, setAnimKey] = useState(0)

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

    // ─── Slide transition ──────────────────────────────────────
    const goToStep = useCallback((newStep: Step, dir: 'forward' | 'back' = 'forward') => {
        setDirection(dir)
        setAnimKey(k => k + 1)
        setStep(newStep)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }, [])

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

    // ─── Step 2: Load seats ────────────────────────────────────
    const handleSelectSchedule = async (schedule: any) => {
        setSelectedSchedule(schedule)
        setLoadingSeats(true)
        setSelectedSeat(null)
        goToStep('seats', 'forward')

        const { data: seatData } = await supabase
            .from('seats')
            .select('*')
            .eq('schedule_id', schedule.id)
            .order('seat_number')

        setSeats(seatData || [])
        setLoadingSeats(false)

        // Realtime
        const channel = supabase
            .channel('seats_' + schedule.id)
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

    // ─── Progress ──────────────────────────────────────────────
    const stepList: { key: Step; label: string; num: number }[] = [
        { key: 'results', label: 'Select Bus', num: 1 },
        { key: 'seats', label: 'Pick Seat', num: 2 },
        { key: 'confirm', label: 'Pay', num: 3 },
    ]
    const currentIdx = stepList.findIndex(s => s.key === step)

    // ─── Seat layout: 2+2 with aisle (like the seat map image) ─
    // Parse seats into rows of 4 (seats 1-4, 5-8, etc.)
    const seatsByNumber = seats.sort((a, b) => {
        const numA = parseInt(a.seat_number)
        const numB = parseInt(b.seat_number)
        return numA - numB
    })

    const seatRows: any[][] = []
    for (let i = 0; i < seatsByNumber.length; i += 4) {
        seatRows.push(seatsByNumber.slice(i, i + 4))
    }

    const price = selectedSchedule?.routes?.base_price_etb ?? 0

    // Background image for each step
    const bgImage = step === 'results' ? '/bus-side.jpg' : step === 'seats' ? '/bus-interior.jpg' : '/bus-aerial.jpg'

    return (
        <div style={{ minHeight: '100vh', position: 'relative' }}>
            {/* ─── Background Image (changes per step) ───── */}
            <div className="step-bg" key={'bg-' + step}>
                <img src={bgImage} alt="" />
                <div className="step-bg-overlay" />
            </div>

            {/* ─── Header ───── */}
            <div style={{ position: 'relative', zIndex: 10, padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="container-wide" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button className="back-btn" onClick={() => {
                        if (step === 'confirm') goToStep('seats', 'back')
                        else if (step === 'seats') goToStep('results', 'back')
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

            {/* ─── Progress Bar ───── */}
            <div className="container-wide" style={{ position: 'relative', zIndex: 10 }}>
                <div className="progress-bar">
                    {stepList.map((s, i) => (
                        <div key={s.key} style={{ display: 'contents' }}>
                            <div className={`progress-step ${i < currentIdx ? 'done' : i === currentIdx ? 'active' : ''}`}>
                                <div className="step-num">
                                    {i < currentIdx ? '✓' : s.num}
                                </div>
                                <span>{s.label}</span>
                            </div>
                            {i < stepList.length - 1 && (
                                <div className={`progress-line ${i < currentIdx ? 'filled' : ''}`} />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* ─── Step Content (slides left/right) ───── */}
            <div className="container-wide" style={{ position: 'relative', zIndex: 10, paddingBottom: '4rem' }}>
                <div key={animKey} className={direction === 'forward' ? 'step-forward' : 'step-back'}>

                    {/* ═══════════ STEP 1: AVAILABLE BUSES ═══════════ */}
                    {step === 'results' && (
                        <div>
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                                Available Buses
                            </h2>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                                {schedules.length > 0 ? `${schedules.length} bus${schedules.length > 1 ? 'es' : ''} found for this route` : ''}
                            </p>

                            {loadingResults ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="skeleton" style={{ height: '100px' }} />
                                    ))}
                                </div>
                            ) : schedules.length === 0 ? (
                                <div className="glass" style={{ padding: '3rem', textAlign: 'center' }}>
                                    <p style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🚌</p>
                                    <h3 style={{ marginBottom: '0.5rem' }}>No buses found</h3>
                                    <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Try a different date or route.</p>
                                    <button className="btn btn-outline" onClick={() => router.push('/')}>← Search Again</button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {schedules.map((schedule, i) => (
                                        <div
                                            key={schedule.id}
                                            className="glass glass-hover"
                                            onClick={() => handleSelectSchedule(schedule)}
                                            style={{
                                                padding: '1.25rem', cursor: 'pointer',
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                animation: `fadeInUp 0.5s ${i * 0.1}s both`
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <img src="/bus-side.jpg" alt="bus" style={{
                                                    width: '70px', height: '45px', borderRadius: '8px', objectFit: 'cover',
                                                    border: '1px solid var(--card-border)'
                                                }} />
                                                <div>
                                                    <p style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: '1.1rem' }}>
                                                        🕐 {schedule.departure_time}
                                                        <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.85rem' }}> → {schedule.arrival_time || 'TBD'}</span>
                                                    </p>
                                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>
                                                        🚌 {schedule.buses.plate_number} &nbsp;•&nbsp; {schedule.routes.distance_km} km
                                                    </p>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <p style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '1.4rem', color: 'var(--gold)' }}>
                                                    {schedule.routes.base_price_etb}
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}> ETB</span>
                                                </p>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--emerald)', fontWeight: 600 }}>Select →</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ═══════════ STEP 2: SEAT PICKER ═══════════ */}
                    {step === 'seats' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.5rem' }}>Pick Your Seat</h2>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                                        🕐 {selectedSchedule?.departure_time} &nbsp;•&nbsp; 🚌 {selectedSchedule?.buses?.plate_number}
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '1.3rem', color: 'var(--gold)' }}>
                                        {price} ETB
                                    </p>
                                </div>
                            </div>

                            {loadingSeats ? (
                                <div className="skeleton" style={{ height: '500px', borderRadius: '20px' }} />
                            ) : (
                                <>
                                    {/* Seat Legend */}
                                    <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', fontSize: '0.8rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: 'linear-gradient(180deg, #3B82F6, #1E40AF)', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }} />
                                            <span style={{ color: 'var(--text-muted)' }}>Available</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: 'linear-gradient(180deg, #FBBF24, #D97706)', boxShadow: '0 2px 4px rgba(245,158,11,0.4)' }} />
                                            <span style={{ color: 'var(--text-muted)' }}>Selected</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: 'linear-gradient(180deg, #6B7280, #374151)', opacity: 0.6 }} />
                                            <span style={{ color: 'var(--text-muted)' }}>Booked</span>
                                        </div>
                                    </div>

                                    {/* Bus Interior Seat Grid */}
                                    <div className="seat-grid-wrapper">
                                        {/* Bus interior as background */}
                                        <div className="seat-grid-bg">
                                            <img src="/bus-interior.jpg" alt="Bus interior" />
                                        </div>

                                        <div className="seat-grid-content">
                                            {/* Driver / Front label */}
                                            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                                                <div style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                                                    padding: '6px 16px', borderRadius: '20px',
                                                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
                                                    border: '1px solid rgba(255,255,255,0.15)'
                                                }}>
                                                    <span style={{ fontSize: '1rem' }}>🪟</span>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text)', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600 }}>
                                                        FRONT · DRIVER
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Seat Rows: 2 left | aisle | 2 right */}
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                {seatRows.map((row, rowIdx) => (
                                                    <div key={rowIdx} style={{
                                                        display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center',
                                                        animation: `fadeInUp 0.3s ${rowIdx * 0.04}s both`
                                                    }}>
                                                        {/* Left pair */}
                                                        {row.slice(0, 2).map((seat: any) => {
                                                            const isSelected = selectedSeat === seat.seat_number
                                                            const isBooked = seat.is_booked
                                                            return (
                                                                <button
                                                                    key={seat.id}
                                                                    disabled={isBooked}
                                                                    onClick={() => setSelectedSeat(seat.seat_number)}
                                                                    className={`seat ${isSelected ? 'seat-selected' : ''} ${isBooked ? 'seat-booked' : ''}`}
                                                                >
                                                                    {!isBooked && seat.seat_number}
                                                                </button>
                                                            )
                                                        })}

                                                        {/* Aisle */}
                                                        <div style={{ width: '36px', display: 'flex', justifyContent: 'center' }}>
                                                            {rowIdx === 0 && (
                                                                <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)', writingMode: 'vertical-lr', letterSpacing: '2px' }}>
                                                                    AISLE
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Right pair */}
                                                        {row.slice(2, 4).map((seat: any) => {
                                                            const isSelected = selectedSeat === seat.seat_number
                                                            const isBooked = seat.is_booked
                                                            return (
                                                                <button
                                                                    key={seat.id}
                                                                    disabled={isBooked}
                                                                    onClick={() => setSelectedSeat(seat.seat_number)}
                                                                    className={`seat ${isSelected ? 'seat-selected' : ''} ${isBooked ? 'seat-booked' : ''}`}
                                                                >
                                                                    {!isBooked && seat.seat_number}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Rear label */}
                                            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                                                <div style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                                                    padding: '6px 16px', borderRadius: '20px',
                                                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
                                                    border: '1px solid rgba(255,255,255,0.15)'
                                                }}>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--danger)', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600 }}>
                                                        🚨 EMERGENCY EXIT · REAR
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Continue */}
                                    <div style={{
                                        marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '1rem 1.25rem', borderRadius: 'var(--radius-sm)',
                                        background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)',
                                        border: '1px solid var(--card-border)'
                                    }}>
                                        <p style={{ fontFamily: 'Outfit', fontWeight: 600 }}>
                                            {selectedSeat ? (
                                                <span>Seat <span style={{ color: 'var(--gold)', fontSize: '1.2rem' }}>{selectedSeat}</span></span>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)' }}>Tap a seat to select</span>
                                            )}
                                        </p>
                                        <button
                                            disabled={!selectedSeat}
                                            onClick={() => goToStep('confirm', 'forward')}
                                            className="btn btn-gold"
                                        >
                                            Continue →
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* ═══════════ STEP 3: CONFIRM & PAY ═══════════ */}
                    {step === 'confirm' && (
                        <div>
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>
                                Confirm & Pay
                            </h2>

                            {/* Trip Summary Card */}
                            <div className="glass" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <img src="/bus-side.jpg" alt="" style={{
                                            width: '60px', height: '40px', borderRadius: '8px', objectFit: 'cover',
                                            border: '1px solid var(--card-border)'
                                        }} />
                                        <div>
                                            <p style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: '1.05rem' }}>
                                                {from} → {to}
                                            </p>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>
                                                {date} &nbsp;•&nbsp; {selectedSchedule?.departure_time} &nbsp;•&nbsp; Seat <span style={{ color: 'var(--gold)' }}>{selectedSeat}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <p style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '1.4rem', color: 'var(--gold)' }}>
                                        {price} <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>ETB</span>
                                    </p>
                                </div>
                            </div>

                            {/* Form */}
                            <form onSubmit={handlePay} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px', display: 'block', fontWeight: 500 }}>
                                        Full Name
                                    </label>
                                    <input className="input" placeholder="e.g. Abebe Kebede" value={name} onChange={e => setName(e.target.value)} required />
                                </div>

                                <div>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px', display: 'block', fontWeight: 500 }}>
                                        Phone Number
                                    </label>
                                    <input className="input" placeholder="09XXXXXXXX" value={phone} onChange={e => setPhone(e.target.value)} required />
                                </div>

                                <div style={{
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
                                    className="btn btn-emerald btn-full"
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
