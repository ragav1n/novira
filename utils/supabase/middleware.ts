import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Per-instance cache of validated access tokens. Cuts getUser() round-trips for
// hot navigation paths (a user clicking around triggers many middleware passes
// inside the auth cookie's lifetime). RLS remains the real security boundary;
// a short TTL bounds how long a revoked token could slip through.
const TOKEN_CACHE_TTL_MS = 30_000;
const tokenCache = new Map<string, number>();

function isTokenCached(token: string): boolean {
    const expiry = tokenCache.get(token);
    if (!expiry) return false;
    if (expiry < Date.now()) {
        tokenCache.delete(token);
        return false;
    }
    return true;
}

function rememberToken(token: string) {
    if (tokenCache.size > 1000) {
        // bound memory; oldest entries are discarded by Map insertion order
        const oldest = tokenCache.keys().next().value;
        if (oldest) tokenCache.delete(oldest);
    }
    tokenCache.set(token, Date.now() + TOKEN_CACHE_TTL_MS);
}

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        request.cookies.set(name, value)
                    )
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // 1. Early exit for static files and specific paths to avoid redundant getUser() calls
    const path = request.nextUrl.pathname;
    if (
        path === '/' ||
        path.startsWith('/signin') ||
        path.startsWith('/signup') ||
        path.startsWith('/forgot-password') ||
        path.startsWith('/update-password') ||
        path.startsWith('/privacy') ||
        path.startsWith('/terms') ||
        path.startsWith('/auth') ||
        path.startsWith('/confirm-delete') ||
        path.startsWith('/_next') ||
        path.startsWith('/api') ||
        path.includes('.')
    ) {
        return supabaseResponse;
    }

    // 2. Skip getUser() if we've validated this exact access token recently.
    // Supabase auth cookies are split (auth-token.0, auth-token.1) so use both
    // values as the cache key — any rotation invalidates the cache automatically.
    const tokenKey = request.cookies
        .getAll()
        .filter(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'))
        .map(c => `${c.name}=${c.value}`)
        .sort()
        .join('|');

    if (tokenKey && isTokenCached(tokenKey)) {
        return supabaseResponse;
    }

    // 3. Validate user via getUser() which verifies the JWT against Supabase's auth server
    // getSession() only reads from cookies and is NOT guaranteed to be authentic
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        const url = request.nextUrl.clone()
        url.pathname = '/signin'
        return NextResponse.redirect(url)
    }

    if (tokenKey) rememberToken(tokenKey);

    return supabaseResponse
}
