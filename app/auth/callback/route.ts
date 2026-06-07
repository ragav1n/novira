import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    let next = searchParams.get('next') ?? '/'
    if (!next.startsWith('/') || next.startsWith('//')) next = '/'

    if (code) {
        const cookieStore = await cookies()
        const redirectResponse = NextResponse.redirect(new URL(next, origin))

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() { return cookieStore.getAll() },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            redirectResponse.cookies.set(name, value, options)
                        })
                    },
                },
            }
        )

        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) return redirectResponse

        // Surface the real reason in Vercel runtime logs. The classic
        // first-attempt-fails/second-succeeds OAuth bug is a missing or stale PKCE
        // code-verifier cookie — log whether one was actually present on this request.
        const hadVerifier = cookieStore
            .getAll()
            .some((c) => c.name.startsWith('sb-') && c.name.includes('code-verifier'))
        console.error('[auth/callback] exchangeCodeForSession failed', {
            name: error.name,
            message: error.message,
            code: (error as { code?: string }).code,
            status: (error as { status?: number }).status,
            hadCodeVerifierCookie: hadVerifier,
        })
    } else {
        // No ?code= means the provider returned an error param or hash/implicit
        // tokens instead of an authorization code — log it so it isn't invisible.
        console.error('[auth/callback] missing authorization code', {
            error: searchParams.get('error'),
            errorDescription: searchParams.get('error_description'),
        })
    }

    return NextResponse.redirect(new URL('/signin?error=auth_code_error', origin))
}
