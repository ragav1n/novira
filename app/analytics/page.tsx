'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { DataBoundary } from '@/components/boundaries/data-boundary';
import { PageTransition } from '@/components/page-transition';

const AnalyticsSkeleton = () => (
  <PageSkeleton width="4xl" title="w-32">
    <Skeleton className="h-[200px] w-full rounded-3xl" />
    <Skeleton className="h-[250px] w-full rounded-[2rem] mt-4" />
  </PageSkeleton>
);

const AnalyticsView = dynamic(
  () => import('@/components/analytics-view').then((mod) => mod.AnalyticsView),
  { ssr: false, loading: () => <AnalyticsSkeleton /> }
);

export default function AnalyticsPage() {
    return (
        <PageTransition>
            <DataBoundary onReset={() => window.location.reload()}>
                <AnalyticsView />
            </DataBoundary>
        </PageTransition>
    );
}
