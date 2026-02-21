import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function proxy(request: NextRequest) {
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
    const isDev = process.env.NODE_ENV === 'development'

    const csp = [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval' blob: https://unpkg.com https://cdn.jsdelivr.net https://va.vercel-scripts.com ${isDev ? "'unsafe-eval'" : ''}`,
        `style-src 'self' 'unsafe-inline'`,
        "img-src 'self' blob: data: https://*.supabase.co",
        "media-src 'self' blob: data:",
        "font-src 'self'",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.frankfurter.dev https://unpkg.com https://cdn.jsdelivr.net https://*.gstatic.com https://cdnjs.cloudflare.com https://va.vercel-scripts.com",
        "worker-src 'self' blob: https://unpkg.com https://cdn.jsdelivr.net",
        "child-src 'self' blob: https://unpkg.com https://cdn.jsdelivr.net",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "upgrade-insecure-requests",
    ].join('; ')

    // Set nonce directly on the NextRequest headers
    request.headers.set('x-nonce', nonce)

    // Pass the original NextRequest (now with nonce header) to Supabase
    const response = await updateSession(request)

    // Set CSP and security headers ON that same response
    response.headers.set('Content-Security-Policy', csp)
    response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
    response.headers.set('Cross-Origin-Embedder-Policy', 'unsafe-none')
    response.headers.set('Cross-Origin-Resource-Policy', 'cross-origin')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()')

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
