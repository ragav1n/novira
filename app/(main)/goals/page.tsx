'use client';

import dynamic from 'next/dynamic';
import { UIBoundary } from '@/components/boundaries/ui-boundary';

const GoalsSkeleton = () => (
  <div className="flex flex-col min-h-screen p-5 space-y-6 max-w-md mx-auto">
    <div className="flex justify-between items-center pt-2 gap-2 opacity-50">
      <div className="w-10 h-10 rounded-full bg-secondary/20 animate-pulse" />
      <div className="h-6 w-32 bg-secondary/20 rounded-lg animate-pulse" />
    </div>
    <div className="space-y-4 mt-4">
      <div className="h-24 w-full rounded-3xl bg-secondary/10 animate-pulse" />
      <div className="h-24 w-full rounded-3xl bg-secondary/10 animate-pulse" />
      <div className="h-24 w-full rounded-3xl bg-secondary/10 animate-pulse" />
    </div>
  </div>
);

const GoalsView = dynamic(
  () => import('@/components/goals-view').then((mod) => mod.GoalsView),
  { ssr: false, loading: () => <GoalsSkeleton /> }
);

export default function GoalsPage() {
    return (
        <UIBoundary>
            <GoalsView />
        </UIBoundary>
    );
}
