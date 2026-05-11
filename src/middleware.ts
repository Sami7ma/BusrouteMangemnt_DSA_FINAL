import { NextResponse, NextRequest } from 'next/server'

// ─── In-memory rate limiter ──────────────────────────────
// For production, replace with Redis-backed limiter (e.g. @upstash/ratelimit)
const rateMap = new Map<string, { count: number; reset: number }>()
const WINDOW_MS = 60_000   // 1 minute
const MAX_REQUESTS = 30    // per window per IP+path

// Cleanup stale entries every 5 minutes to prevent memory leak
setInterval(() => {
    const now = Date.now()
    for (const [key, val] of rateMap.entries()) {
        if (now > val.reset) rateMap.delete(key)
    }
}, 300_000)

export function middleware(req: NextRequest) {
    // Only rate-limit API routes
    if (!req.nextUrl.pathname.startsWith('/api/')) {
        return NextResponse.next()
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || req.headers.get('x-real-ip')
        || 'unknown'
    const key = `${ip}:${req.nextUrl.pathname}`
    const now = Date.now()
    const entry = rateMap.get(key)

    if (!entry || now > entry.reset) {
        rateMap.set(key, { count: 1, reset: now + WINDOW_MS })
        return NextResponse.next()
    }

    entry.count++
    if (entry.count > MAX_REQUESTS) {
        return NextResponse.json(
            { error: 'Too many requests. Please wait a moment and try again.' },
            {
                status: 429,
                headers: {
                    'Retry-After': String(Math.ceil((entry.reset - now) / 1000)),
                }
            }
        )
    }

    return NextResponse.next()
}

export const config = {
    matcher: '/api/:path*',
}
