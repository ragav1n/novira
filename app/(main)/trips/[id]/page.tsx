'use client';

import { use } from 'react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { UIBoundary } from '@/components/boundaries/ui-boundary';
import { PageTransition } from '@/components/page-transition';

const TripDetailSkeleton = () => (
    // Keeps its own header shape — a detail route has no avatar/action triplet, so
    // PageSkeleton doesn't apply. `100dvh` for the same reason as there: `min-h-screen`
    // measures the largest mobile viewport and forces a scrollbar during load.
    <div role="status" aria-label="Loading" className="flex flex-col min-h-[100dvh] p-5 max-w-md mx-auto space-y-4">
        <Skeleton tone="chip" className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-24 rounded-3xl" />
    </div>
);

const TripDetailView = dynamic(
    () => import('@/components/trips/trip-detail-view').then((mod) => mod.TripDetailView),
    { ssr: false, loading: () => <TripDetailSkeleton /> }
);

export default function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    return (
        <PageTransition>
            <UIBoundary>
                <TripDetailView tripId={id} />
            </UIBoundary>
        </PageTransition>
    );
}
