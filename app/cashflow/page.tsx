'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { DataBoundary } from '@/components/boundaries/data-boundary';
import { PageTransition } from '@/components/page-transition';

const CalendarSkeleton = () => (
  <PageSkeleton width="2xl" title="w-32">
    <Skeleton className="h-[300px] w-full rounded-3xl" />
    <Skeleton className="h-[180px] w-full rounded-xl" />
  </PageSkeleton>
);

const CalendarView = dynamic(
  () => import('@/components/calendar-view').then((mod) => mod.CalendarView),
  { ssr: false, loading: () => <CalendarSkeleton /> }
);

export default function CalendarPage() {
    return (
        <PageTransition>
            <DataBoundary onReset={() => window.location.reload()}>
                <CalendarView />
            </DataBoundary>
        </PageTransition>
    );
}
