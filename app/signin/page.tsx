'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Component as SignInCard } from '@/components/sign-in-card'

function SignInContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    // Supabase auth handles redirection to /auth/callback on the server side
    // No need for client-side redirection here which can cause loops or hydration issues

    return <SignInCard isSignUp={false} />
}

export default function SignInPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <SignInContent />
        </Suspense>
    )
}
