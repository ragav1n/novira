'use client';

import { use } from 'react';
import dynamic from 'next/dynamic';
import { UIBoundary } from '@/components/boundaries/ui-boundary';
import { PageTransition } from '@/components/page-transition';

const TripDetailSkeleton = () => (
    <div className="flex flex-col min-h-screen p-5 max-w-md mx-auto space-y-4">
        <div className="h-10 w-32 bg-secondary/20 rounded-lg animate-pulse" />
        <div className="h-32 bg-secondary/10 rounded-3xl animate-pulse" />
        <div className="h-24 bg-secondary/10 rounded-3xl animate-pulse" />
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
