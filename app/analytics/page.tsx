'use client';

import dynamic from 'next/dynamic';
import { DataBoundary } from '@/components/boundaries/data-boundary';

const AnalyticsSkeleton = () => (
  <div className="flex flex-col min-h-screen p-5 space-y-6 max-w-md mx-auto">
    <div className="flex justify-between items-center pt-2 gap-2 opacity-50">
      <div className="w-10 h-10 rounded-full bg-secondary/20 animate-pulse" />
      <div className="h-6 w-32 bg-secondary/20 rounded-lg animate-pulse" />
      <div className="w-10 h-10 rounded-full bg-secondary/20 animate-pulse" />
    </div>
    <div className="h-[200px] w-full rounded-3xl bg-secondary/10 animate-pulse" />
    <div className="h-[250px] w-full rounded-[2rem] bg-secondary/10 animate-pulse mt-4" />
  </div>
);

const AnalyticsView = dynamic(
  () => import('@/components/analytics-view').then((mod) => mod.AnalyticsView),
  { ssr: false, loading: () => <AnalyticsSkeleton /> }
);

export default function AnalyticsPage() {
    return (
        <DataBoundary onReset={() => window.location.reload()}>
            <AnalyticsView />
        </DataBoundary>
    );
}
