import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function proxy(request: NextRequest) {
    const csp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://unpkg.com https://cdn.jsdelivr.net https://va.vercel-scripts.com https://maps.googleapis.com",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' blob: data: https://*.supabase.co https://*.mapbox.com https://*.googleusercontent.com https://maps.googleapis.com https://maps.gstatic.com https://staticmap.openstreetmap.de",
        "media-src 'self' blob: data:",
        "font-src 'self'",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.frankfurter.dev https://v6.exchangerate-api.com https://unpkg.com https://cdn.jsdelivr.net https://*.gstatic.com https://cdnjs.cloudflare.com https://va.vercel-scripts.com https://*.mapbox.com https://maps.googleapis.com https://places.googleapis.com",
        "worker-src 'self' blob: https://unpkg.com https://cdn.jsdelivr.net",
        "child-src 'self' blob: https://unpkg.com https://cdn.jsdelivr.net",
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
    response.headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=*')
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')

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
