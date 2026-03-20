'use client'

import { Suspense } from 'react'
import { Component as SignInCard } from '@/components/sign-in-card'

export default function SignUpPage() {
  return (
    <Suspense>
      <SignInCard isSignUp={true} />
    </Suspense>
  )
}
