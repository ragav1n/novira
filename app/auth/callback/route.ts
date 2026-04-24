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
    }

    return NextResponse.redirect(new URL('/signin?error=auth_code_error', origin))
}
