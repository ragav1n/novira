'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { UIBoundary } from '@/components/boundaries/ui-boundary';
import { PageTransition } from '@/components/page-transition';

const GoalsSkeleton = () => (
  <PageSkeleton width="2xl" title="w-32">
    <div className="space-y-4 mt-4">
      <Skeleton className="h-24 w-full rounded-3xl" />
      <Skeleton className="h-24 w-full rounded-3xl" />
      <Skeleton className="h-24 w-full rounded-3xl" />
    </div>
  </PageSkeleton>
);

const GoalsView = dynamic(
  () => import('@/components/goals-view').then((mod) => mod.GoalsView),
  { ssr: false, loading: () => <GoalsSkeleton /> }
);

export default function GoalsPage() {
    return (
        <PageTransition>
            <UIBoundary>
                <GoalsView />
            </UIBoundary>
        </PageTransition>
    );
}
