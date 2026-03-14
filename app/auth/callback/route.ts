import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'edge'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    // if "next" is in param, use it as the redirect URL
    let next = searchParams.get('next') ?? '/'

    // Basic open redirect protection: Ensure next starts with / and not //
    if (!next.startsWith('/') || next.startsWith('//')) {
        next = '/'
    }

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            // Priority 1: Use specific NEXT_PUBLIC_APP_URL from env
            const envAppUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
            
            // Priority 2: Use headers for dynamic environment detection (Vercel previews, etc)
            const forwardedHost = request.headers.get('x-forwarded-host')
            const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
            
            // Priority 3: Use the request origin
            
            let redirectBase = origin;

            if (envAppUrl) {
                redirectBase = envAppUrl;
            } else if (forwardedHost) {
                const protocol = forwardedHost.includes('localhost') ? 'http' : forwardedProto
                redirectBase = `${protocol}://${forwardedHost}`
            }

            return NextResponse.redirect(`${redirectBase}${next}`)
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/signin?error=auth_code_error`)
}
