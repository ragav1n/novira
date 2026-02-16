'use client'

import { DashboardView } from '@/components/dashboard-view'
import { Component as SignInCard } from '@/components/sign-in-card'

import { useUserPreferences } from '@/components/providers/user-preferences-provider'

export default function Page() {
  const { isAuthenticated, isLoading } = useUserPreferences()

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] w-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <SignInCard isSignUp={false} />
  }

  return <DashboardView />
}
