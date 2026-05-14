'use client';

import dynamic from 'next/dynamic';
import { UIBoundary } from '@/components/boundaries/ui-boundary';
import { PageTransition } from '@/components/page-transition';

const TripsSkeleton = () => (
    <div className="flex flex-col min-h-screen p-5 space-y-6 max-w-md mx-auto">
        <div className="flex justify-between items-center pt-2 gap-2 opacity-50">
            <div className="w-10 h-10 rounded-full bg-secondary/20 animate-pulse" />
            <div className="h-6 w-24 bg-secondary/20 rounded-lg animate-pulse" />
            <div className="w-10 h-10 rounded-full bg-secondary/20 animate-pulse" />
        </div>
        <div className="space-y-4 mt-4">
            <div className="h-24 w-full rounded-3xl bg-secondary/10 animate-pulse" />
            <div className="h-24 w-full rounded-3xl bg-secondary/10 animate-pulse" />
        </div>
    </div>
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
