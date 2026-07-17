import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function proxy(request: NextRequest) {
    const csp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://va.vercel-scripts.com",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' blob: data: https://*.supabase.co https://*.mapbox.com https://*.googleusercontent.com https://maps.googleapis.com https://maps.gstatic.com",
        "media-src 'self' blob: data:",
        "font-src 'self'",
        // v6.exchangerate-api.com is intentionally absent: the client only ever
        // reaches it through the authenticated /api/exchange-rate proxy.
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.frankfurter.dev https://*.gstatic.com https://va.vercel-scripts.com https://*.mapbox.com https://maps.googleapis.com https://places.googleapis.com https://photon.komoot.io",
        "worker-src 'self' blob:",
        "child-src 'self' blob:",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "upgrade-insecure-requests",
    ].join('; ')

    const response = await updateSession(request)

    // Set CSP and security headers ON that same response
    response.headers.set('Content-Security-Policy', csp)
    response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
    response.headers.set('Cross-Origin-Embedder-Policy', 'unsafe-none')
    response.headers.set('Cross-Origin-Resource-Policy', 'cross-origin')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self)')
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
    // Legacy-browser twin of CSP frame-ancestors 'none'
    response.headers.set('X-Frame-Options', 'DENY')

    return response
}

export const config = {
    matcher: [
        {
            source: '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|wasm)$).*)',
            missing: [
                { type: 'header', key: 'next-router-prefetch' },
                { type: 'header', key: 'purpose', value: 'prefetch' },
            ],
        },
    ],
}
