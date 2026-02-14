'use client'

import { Component as SignInCard } from '@/components/sign-in-card'

export default function SignInPage() {
    return (
        <div className="min-h-screen w-screen relative overflow-hidden flex items-center justify-center">
            <div className="relative z-10">
                <SignInCard isSignUp={false} />
            </div>
        </div>
    )
}
