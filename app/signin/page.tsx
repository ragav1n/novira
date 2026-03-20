'use client'

import { Suspense } from 'react'
import { Component as SignInCard } from '@/components/sign-in-card'

export default function SignInPage() {
    return (
        <Suspense>
            <SignInCard isSignUp={false} />
        </Suspense>
    )
}
