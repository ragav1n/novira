'use client'

import dynamic from 'next/dynamic'
import { PageSkeleton } from '@/components/ui/page-skeleton'
import { Skeleton } from '@/components/ui/skeleton'
import { DataBoundary } from '@/components/boundaries/data-boundary'
import { PageTransition } from '@/components/page-transition'

// Matches the shape GroupsView renders once loaded, so the hand-off doesn't jump.
// Previously this route showed a bespoke full-viewport spinner and then a second,
// different skeleton — two loading languages back to back — and imported GroupsView
// statically, so it was never code-split.
const GroupsSkeleton = () => (
  // Was a near-miss copy of the shared header: `items-center gap-3` instead of
  // `justify-between`, and 36px chips where the real ViewHeader's targets are 44px.
  <PageSkeleton width="2xl" title="w-40">
    <Skeleton className="h-24 w-full rounded-3xl" />
    <Skeleton className="h-10 w-full rounded-xl" />
    <div className="space-y-2">
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-20 w-full rounded-xl" />
    </div>
  </PageSkeleton>
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
