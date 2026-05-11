import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    async headers() {
        return [{
            source: '/(.*)',
            headers: [
                { key: 'X-Frame-Options', value: 'DENY' },
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                { key: 'X-XSS-Protection', value: '1; mode=block' },
                { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
                {
                    key: 'Content-Security-Policy',
                    value: [
                        "default-src 'self'",
                        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
                        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                        "font-src 'self' https://fonts.gstatic.com",
                        "img-src 'self' data: blob:",
                        "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.chapa.co",
                    ].join('; ')
                },
            ]
        }]
    }
};

export default nextConfig;
