import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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

    // 2. Validate user via getUser() which verifies the JWT against Supabase's auth server
    // getSession() only reads from cookies and is NOT guaranteed to be authentic
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        // no user, potentially respond by redirecting the user to the login page
        const url = request.nextUrl.clone()
        url.pathname = '/signin'
        return NextResponse.redirect(url)
    }

    return supabaseResponse
}
