'use client'

import { Component as SignInCard } from '@/components/sign-in-card'
import dynamic from 'next/dynamic'
import { WaveLoader } from '@/components/ui/wave-loader'

// App Shell Skeleton for Dashboard
const DashboardSkeleton = () => (
  <div className="flex flex-col min-h-screen p-5 space-y-6 max-w-md mx-auto">
    <div className="flex justify-between items-center pt-2 gap-2 opacity-50">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-full bg-secondary/20 animate-pulse" />
        <div className="space-y-1">
          <div className="h-5 w-24 bg-secondary/20 rounded animate-pulse" />
          <div className="h-3 w-32 bg-secondary/20 rounded animate-pulse" />
        </div>
      </div>
    </div>
    <div className="h-[200px] w-full rounded-3xl bg-secondary/10 animate-pulse" />
    <div className="h-[300px] w-full rounded-3xl bg-secondary/10 animate-pulse mt-4" />
  </div>
)

const DashboardView = dynamic(
  () => import('@/components/dashboard-view').then((mod) => mod.DashboardView),
  { ssr: false, loading: () => <DashboardSkeleton /> }
)

import { useUserPreferences } from '@/components/providers/user-preferences-provider'
import { DataBoundary } from '@/components/boundaries/data-boundary'

export default function Page() {
  const { isAuthenticated, isLoading } = useUserPreferences()

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-background">
        {/* Instant App Shell Loading Experience */}
        <div className="w-20 h-20 relative mb-8 animate-pulse opacity-50">
            <img src="/Novira.png" alt="Novira" className="w-full h-full object-contain drop-shadow-[0_0_8px_rgba(138,43,226,0.5)]" />
        </div>
        <WaveLoader bars={5} message="" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <SignInCard isSignUp={false} />
  }

  return (
    <DataBoundary onReset={() => window.location.reload()}>
      <DashboardView />
    </DataBoundary>
  )
}
