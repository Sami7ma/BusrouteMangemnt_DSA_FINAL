"use client"

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Step = 'results' | 'seats' | 'confirm'

// Parse seat label like "1A","1B","1C","1D" -> row 1, col A/B/C/D
function parseSeat(seatNumber: string) {
    const match = seatNumber.match(/^(\d+)([A-Z]+)$/)
    if (!match) return { row: 0, col: seatNumber }
    return { row: parseInt(match[1]), col: match[2] }
}

export default function BookingFlow() {
    const searchParams = useSearchParams()
    const router = useRouter()

    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const date = searchParams.get('date')

    const [step, setStep] = useState<Step>('results')
    const [direction, setDirection] = useState<'forward' | 'back'>('forward')
    const [animKey, setAnimKey] = useState(0)

    const [schedules, setSchedules] = useState<any[]>([])
    const [loadingResults, setLoadingResults] = useState(true)

    const [selectedSchedule, setSelectedSchedule] = useState<any>(null)
    const [seats, setSeats] = useState<any[]>([])
    const [selectedSeats, setSelectedSeats] = useState<string[]>([])
    const [loadingSeats, setLoadingSeats] = useState(false)

    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [paying, setPaying] = useState(false)

    const goToStep = useCallback((newStep: Step, dir: 'forward' | 'back' = 'forward') => {
        setDirection(dir)
        setAnimKey(k => k + 1)
        setStep(newStep)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }, [])

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

    const handleSelectSchedule = async (schedule: any) => {
        setSelectedSchedule(schedule)
        setLoadingSeats(true)
        setSelectedSeats([])
        goToStep('seats', 'forward')

        const { data: seatData } = await supabase
            .from('seats')
            .select('*')
            .eq('schedule_id', schedule.id)
            .order('seat_number')

        setSeats(seatData || [])
        setLoadingSeats(false)

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

    const toggleSeat = (seatNum: string) => {
        setSelectedSeats(prev =>
            prev.includes(seatNum)
                ? prev.filter(s => s !== seatNum)
                : prev.length >= 10 ? (alert('Maximum 10 seats per booking'), prev) : [...prev, seatNum]
        )
    }

    const handlePay = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!/^09\d{8}$/.test(phone)) {
            return alert('Phone must be: 09XXXXXXXX (10 digits)')
        }
        setPaying(true)
        const res = await fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scheduleId: selectedSchedule.id, seatNumbers: selectedSeats, name, phone }),
        })
        const data = await res.json()
        if (data.checkoutUrl) {
            window.location.href = data.checkoutUrl
        } else {
            alert('Error: ' + data.error)
            setPaying(false)
        }
    }

    const stepList: { key: Step; label: string; num: number }[] = [
        { key: 'results', label: 'Select Bus', num: 1 },
        { key: 'seats', label: 'Pick Seats', num: 2 },
        { key: 'confirm', label: 'Pay', num: 3 },
    ]
    const currentIdx = stepList.findIndex(s => s.key === step)
    const pricePerSeat = selectedSchedule?.routes?.base_price_etb ?? 0
    const totalPrice = pricePerSeat * selectedSeats.length

    // Build rows: group seats by row number, left (A,B) and right (C,D)
    const seatMap: Record<number, { left: any[], right: any[] }> = {}
    seats.forEach(seat => {
        const { row, col } = parseSeat(seat.seat_number)
        if (!seatMap[row]) seatMap[row] = { left: [], right: [] }
        if (col === 'A' || col === 'B') {
            seatMap[row].left.push(seat)
        } else {
            seatMap[row].right.push(seat)
        }
    })
    const sortedRows = Object.keys(seatMap).map(Number).sort((a, b) => a - b)
    const availableCount = seats.filter(s => !s.is_booked).length

    const bgImage = step === 'results' ? '/bus-side.jpg' : step === 'seats' ? '/bus-aerial.jpg' : '/bus-aerial.jpg'

    return (
        <div style={{ minHeight: '100vh', position: 'relative', background: 'var(--navy)' }}>
            {/* Background */}
            <div className="step-bg" key={'bg-' + step}>
                <img src={bgImage} alt="" />
                <div className="step-bg-overlay" />
            </div>

            {/* Header */}
            <div style={{ position: 'relative', zIndex: 10, padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}>
                <div className="container-wide" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button className="back-btn" onClick={() => {
                        if (step === 'confirm') goToStep('seats', 'back')
                        else if (step === 'seats') goToStep('results', 'back')
                        else router.push('/')
                    }}>← Back</button>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>
                            {from} → {to}
                        </p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{date}</p>
                    </div>
                </div>
            </div>

            {/* Progress */}
            <div style={{ position: 'relative', zIndex: 10 }}>
                <div className="container-wide">
                    <div className="progress-bar">
                        {stepList.map((s, i) => (
                            <div key={s.key} style={{ display: 'contents' }}>
                                <div className={`progress-step ${i < currentIdx ? 'done' : i === currentIdx ? 'active' : ''}`}>
                                    <div className="step-num">{i < currentIdx ? '✓' : s.num}</div>
                                    <span>{s.label}</span>
                                </div>
                                {i < stepList.length - 1 && <div className={`progress-line ${i < currentIdx ? 'filled' : ''}`} />}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Step Content */}
            <div className="container-wide" style={{ position: 'relative', zIndex: 10, paddingBottom: '4rem' }}>
                <div key={animKey} className={direction === 'forward' ? 'step-forward' : 'step-back'}>

                    {/* ═══ STEP 1: SELECT BUS ═══ */}
                    {step === 'results' && (
                        <div>
                            <h2 style={{ fontSize: '1.6rem', marginBottom: '0.25rem' }}>Available Buses</h2>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                                {!loadingResults && `${schedules.length} bus${schedules.length !== 1 ? 'es' : ''} found · ${from} → ${to}`}
                            </p>

                            {loadingResults ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '88px' }} />)}
                                </div>
                            ) : schedules.length === 0 ? (
                                <div className="glass" style={{ padding: '3rem', textAlign: 'center' }}>
                                    <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚌</p>
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
                                                padding: '1.25rem 1.5rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                gap: '1rem',
                                                animation: `fadeInUp 0.4s ${i * 0.08}s both`,
                                                borderLeft: '3px solid var(--emerald)',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                {/* Bus icon */}
                                                <div style={{
                                                    width: 48, height: 48, borderRadius: 10,
                                                    background: 'linear-gradient(135deg, #16a34a, #065f46)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '1.4rem', flexShrink: 0
                                                }}>🚌</div>
                                                <div>
                                                    <p style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '1.1rem' }}>
                                                        {schedule.departure_time}
                                                        <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.85rem' }}>
                                                            {' '}→ {schedule.arrival_time || 'TBD'}
                                                        </span>
                                                    </p>
                                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 3 }}>
                                                        {schedule.buses?.plate_number} · {schedule.routes?.distance_km} km
                                                    </p>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                <p style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '1.5rem', color: 'var(--gold)', lineHeight: 1 }}>
                                                    {schedule.routes?.base_price_etb}
                                                </p>
                                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ETB · Select →</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ═══ STEP 2: PICK SEAT ═══ */}
                    {step === 'seats' && (
                        <div>
                            {/* Header row */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.4rem' }}>Choose Your Seats</h2>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 3 }}>
                                        🕐 {selectedSchedule?.departure_time} · {selectedSchedule?.buses?.plate_number}
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '1.4rem', color: 'var(--gold)', lineHeight: 1 }}>{pricePerSeat}</p>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ETB per seat</p>
                                </div>
                            </div>

                            {/* Legend */}
                            <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1rem', fontSize: '0.75rem' }}>
                                {[
                                    { img: '/seat-blue.png', label: `Available (${availableCount})` },
                                    { img: '/seat-gold.png', label: 'Selected' },
                                    { img: '/seat-grey.png', label: 'Booked' },
                                ].map(item => (
                                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <img src={item.img} alt="" style={{ width: 18, height: 22, objectFit: 'contain' }} />
                                        <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                                    </div>
                                ))}
                            </div>

                            {loadingSeats ? (
                                <div className="skeleton" style={{ height: 560, borderRadius: 24 }} />
                            ) : (
                                <>
                                    {/* BUS DIAGRAM */}
                                    <div style={{
                                        // Outer bus body - green exterior
                                        background: 'linear-gradient(180deg, #16a34a 0%, #15803d 50%, #166534 100%)',
                                        borderRadius: '32px 32px 20px 20px',
                                        padding: '6px',
                                        boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 2px #14532d',
                                        maxWidth: 460,
                                        margin: '0 auto',
                                    }}>
                                        {/* Inner bus body */}
                                        <div style={{
                                            background: '#1a1a1a',
                                            borderRadius: '28px 28px 16px 16px',
                                            overflow: 'hidden',
                                        }}>
                                            {/* Front cab */}
                                            <div style={{
                                                background: 'linear-gradient(180deg, #111 0%, #222 100%)',
                                                padding: '12px 20px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                borderBottom: '2px solid #333',
                                            }}>
                                                <div style={{ fontSize: '0.65rem', color: '#666', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 600 }}>
                                                    Driver's Cabin
                                                </div>
                                                <div style={{
                                                    background: '#222', border: '1px solid #444', borderRadius: 6,
                                                    padding: '3px 10px', fontSize: '0.65rem', color: '#888', fontWeight: 700
                                                }}>📺 TV</div>
                                                <div style={{ fontSize: '0.65rem', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                                                    FRONT DOOR →
                                                </div>
                                            </div>

                                            {/* Seating area */}
                                            <div style={{
                                                // Wood floor
                                                background: 'linear-gradient(180deg, #3d2b1f 0%, #5c3d28 40%, #3d2b1f 100%)',
                                                padding: '16px 12px',
                                                position: 'relative',
                                            }}>
                                                {/* Aisle label */}
                                                <div style={{
                                                    position: 'absolute',
                                                    left: '50%',
                                                    top: '50%',
                                                    transform: 'translate(-50%, -50%)',
                                                    fontSize: '0.6rem',
                                                    color: 'rgba(255,255,255,0.2)',
                                                    letterSpacing: 3,
                                                    writingMode: 'vertical-lr',
                                                    textTransform: 'uppercase',
                                                    fontWeight: 600,
                                                    pointerEvents: 'none',
                                                    userSelect: 'none',
                                                }}>AISLE</div>

                                                {/* Seat rows */}
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                    {sortedRows.map((rowNum, rowIdx) => {
                                                        const row = seatMap[rowNum]
                                                        return (
                                                            <div key={rowNum} style={{
                                                                display: 'flex',
                                                                justifyContent: 'center',
                                                                alignItems: 'center',
                                                                gap: 6,
                                                                animation: `fadeInUp 0.3s ${rowIdx * 0.03}s both`
                                                            }}>
                                                                {/* Left seats (A, B) */}
                                                                <div style={{ display: 'flex', gap: 4 }}>
                                                                    {row.left.sort((a, b) => parseSeat(a.seat_number).col.localeCompare(parseSeat(b.seat_number).col)).map((seat: any) => {
                                                                        const isSelected = selectedSeats.includes(seat.seat_number)
                                                                        const isBooked = seat.is_booked
                                                                        return (
                                                                            <button
                                                                                key={seat.id}
                                                                                disabled={isBooked}
                                                                                onClick={() => toggleSeat(seat.seat_number)}
                                                                                title={seat.seat_number}
                                                                                className={`seat-img-btn ${isSelected ? 'seat-img-selected' : ''} ${isBooked ? 'seat-img-booked' : ''}`}
                                                                            >
                                                                                <img
                                                                                    src={isBooked ? '/seat-grey.png' : isSelected ? '/seat-gold.png' : '/seat-blue.png'}
                                                                                    alt={seat.seat_number}
                                                                                />
                                                                                <span className="seat-label">{seat.seat_number}</span>
                                                                            </button>
                                                                        )
                                                                    })}
                                                                </div>

                                                                {/* Aisle gap */}
                                                                <div style={{ width: 32, flexShrink: 0 }} />

                                                                {/* Right seats (C, D) */}
                                                                <div style={{ display: 'flex', gap: 4 }}>
                                                                    {row.right.sort((a, b) => parseSeat(a.seat_number).col.localeCompare(parseSeat(b.seat_number).col)).map((seat: any) => {
                                                                        const isSelected = selectedSeats.includes(seat.seat_number)
                                                                        const isBooked = seat.is_booked
                                                                        return (
                                                                            <button
                                                                                key={seat.id}
                                                                                disabled={isBooked}
                                                                                onClick={() => toggleSeat(seat.seat_number)}
                                                                                title={seat.seat_number}
                                                                                className={`seat-img-btn ${isSelected ? 'seat-img-selected' : ''} ${isBooked ? 'seat-img-booked' : ''}`}
                                                                            >
                                                                                <img
                                                                                    src={isBooked ? '/seat-grey.png' : isSelected ? '/seat-gold.png' : '/seat-blue.png'}
                                                                                    alt={seat.seat_number}
                                                                                />
                                                                                <span className="seat-label">{seat.seat_number}</span>
                                                                            </button>
                                                                        )
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>

                                            {/* Rear */}
                                            <div style={{
                                                background: '#111',
                                                padding: '10px 20px',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                borderTop: '2px solid #333',
                                            }}>
                                                <div style={{ fontSize: '0.6rem', color: '#444', textTransform: 'uppercase', letterSpacing: 1 }}>Rear</div>
                                                <div style={{ fontSize: '0.6rem', color: '#dc2626', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                                                    🚨 EMERGENCY EXIT
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Continue bar */}
                                    <div style={{
                                        marginTop: '1.25rem',
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '1rem 1.25rem', borderRadius: 'var(--radius-sm)',
                                        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)',
                                        border: '1px solid var(--card-border)',
                                        maxWidth: 460, margin: '1.25rem auto 0',
                                    }}>
                                        <div>
                                            {selectedSeats.length > 0 ? (
                                                <span style={{ fontFamily: 'Outfit', fontWeight: 600 }}>
                                                    <span style={{ color: 'var(--gold)', fontSize: '1.1rem' }}>{selectedSeats.length}</span>
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                                        {' '}seat{selectedSeats.length > 1 ? 's' : ''} · {selectedSeats.join(', ')} · <strong style={{ color: 'var(--gold)' }}>{totalPrice} ETB</strong>
                                                    </span>
                                                </span>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Tap seats to select (up to 10)</span>
                                            )}
                                        </div>
                                        <button
                                            disabled={selectedSeats.length === 0}
                                            onClick={() => goToStep('confirm', 'forward')}
                                            className="btn btn-gold"
                                        >Continue →</button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* ═══ STEP 3: CONFIRM & PAY ═══ */}
                    {step === 'confirm' && (
                        <div style={{ maxWidth: 480, margin: '0 auto' }}>
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Confirm & Pay</h2>

                            {/* Trip card */}
                            <div className="glass" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <p style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '1.1rem' }}>
                                            {from} → {to}
                                        </p>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 4 }}>
                                            {date} · {selectedSchedule?.departure_time} · {selectedSeats.length} seat{selectedSeats.length > 1 ? 's' : ''}
                                        </p>
                                        <p style={{ color: 'var(--gold)', fontSize: '0.85rem', fontWeight: 600, marginTop: 2 }}>
                                            {selectedSeats.join(', ')}
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '1.5rem', color: 'var(--gold)', lineHeight: 1 }}>{totalPrice}</p>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{selectedSeats.length > 1 ? `${selectedSeats.length} × ${pricePerSeat}` : ''} ETB</p>
                                    </div>
                                </div>
                            </div>

                            <form onSubmit={handlePay} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6, display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                                        Full Name
                                    </label>
                                    <input className="input" placeholder="e.g. Abebe Kebede" value={name} onChange={e => setName(e.target.value)} required />
                                </div>

                                <div>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6, display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                                        Phone Number
                                    </label>
                                    <input className="input" placeholder="09XXXXXXXX" value={phone} onChange={e => setPhone(e.target.value)} required />
                                </div>

                                <div style={{
                                    display: 'flex', alignItems: 'flex-start', gap: 10,
                                    padding: '12px 14px', borderRadius: 'var(--radius-sm)',
                                    background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)'
                                }}>
                                    <span style={{ fontSize: '1rem', marginTop: 1 }}>⚠️</span>
                                    <p style={{ color: 'var(--gold)', fontSize: '0.78rem', lineHeight: 1.5 }}>
                                        Complete your payment promptly. Unpaid seats are automatically released after 15 minutes.
                                    </p>
                                </div>

                                <button
                                    type="submit"
                                    disabled={paying}
                                    className="btn btn-emerald btn-full"
                                    style={{ marginTop: '0.25rem', fontSize: '1rem', padding: '0.9rem' }}
                                >
                                    {paying ? '⏳ Redirecting to Chapa...' : `💳 Pay ${totalPrice} ETB`}
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
