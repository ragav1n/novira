'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import { WaveLoader } from '@/components/ui/wave-loader'
import { useUserPreferences } from '@/components/providers/user-preferences-provider'
import { DataBoundary } from '@/components/boundaries/data-boundary'

const DashboardSkeleton = () => (
  <div className="flex flex-col min-h-[100dvh] p-5 space-y-6 max-w-md mx-auto">
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

export function AuthedHomeClient() {
  const { isLoading } = useUserPreferences()

  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="loading"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-background fixed inset-0 z-[100]"
        >
          <div className="w-20 h-20 relative mb-8">
            <Image
              src="/Novira.png"
              alt="Novira"
              width={80}
              height={80}
              priority
              className="object-contain drop-shadow-[0_0_15px_rgba(138,43,226,0.3)]"
            />
          </div>
          <WaveLoader bars={5} message="" />
        </motion.div>
      ) : (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full"
        >
          <DataBoundary onReset={() => window.location.reload()}>
            <DashboardView />
          </DataBoundary>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
