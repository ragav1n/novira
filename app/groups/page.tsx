'use client'

import dynamic from 'next/dynamic'
import { DataBoundary } from '@/components/boundaries/data-boundary'
import { PageTransition } from '@/components/page-transition'

// Matches the shape GroupsView renders once loaded, so the hand-off doesn't jump.
// Previously this route showed a bespoke full-viewport spinner and then a second,
// different skeleton — two loading languages back to back — and imported GroupsView
// statically, so it was never code-split.
const GroupsSkeleton = () => (
  <div className="flex flex-col min-h-screen p-5 space-y-7 max-w-md mx-auto">
    <div className="flex items-center gap-3 pt-2 opacity-50">
      <div className="w-9 h-9 rounded-full bg-secondary/20 animate-pulse" />
      <div className="h-6 w-40 bg-secondary/20 rounded-lg animate-pulse mx-auto" />
      <div className="w-9 h-9 rounded-full bg-secondary/20 animate-pulse" />
    </div>
    <div className="h-24 w-full rounded-3xl bg-secondary/10 animate-pulse" />
    <div className="h-10 w-full rounded-2xl bg-secondary/10 animate-pulse" />
    <div className="space-y-2">
      <div className="h-20 w-full rounded-2xl bg-secondary/10 animate-pulse" />
      <div className="h-20 w-full rounded-2xl bg-secondary/10 animate-pulse" />
    </div>
  </div>
)

const GroupsView = dynamic(
  () => import('@/components/groups-view').then((mod) => mod.GroupsView),
  { ssr: false, loading: () => <GroupsSkeleton /> }
)

export default function GroupsPage() {
    // Auth redirects are handled centrally by the middleware in proxy.ts plus
    // MobileLayout's `showNav` gate, so this route no longer runs its own.
    return (
        <PageTransition>
            <DataBoundary>
                <GroupsView />
            </DataBoundary>
        </PageTransition>
    )
}
