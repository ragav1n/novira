'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { UIBoundary } from '@/components/boundaries/ui-boundary';
import { PageTransition } from '@/components/page-transition';

const TripsSkeleton = () => (
    <PageSkeleton width="2xl" title="w-24" trailing={false}>
        <div className="space-y-4 mt-4">
            <Skeleton className="h-24 w-full rounded-3xl" />
            <Skeleton className="h-24 w-full rounded-3xl" />
        </div>
    </PageSkeleton>
);

const TripsView = dynamic(
    () => import('@/components/trips/trips-view').then((mod) => mod.TripsView),
    { ssr: false, loading: () => <TripsSkeleton /> }
);

export default function TripsPage() {
    return (
        <PageTransition>
            <UIBoundary>
                <TripsView />
            </UIBoundary>
        </PageTransition>
    );
}
