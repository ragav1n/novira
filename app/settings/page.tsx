'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { DataBoundary } from '@/components/boundaries/data-boundary';
import { PageTransition } from '@/components/page-transition';

const SettingsSkeleton = () => (
  <PageSkeleton width="4xl" title="w-32" trailing={false}>
    <div className="space-y-4 mt-4">
      <Skeleton className="h-14 w-full rounded-xl" />
      <Skeleton className="h-14 w-full rounded-xl" />
      <Skeleton className="h-14 w-full rounded-xl" />
      <Skeleton className="h-14 w-full rounded-xl" />
    </div>
  </PageSkeleton>
);

const SettingsView = dynamic(
  () => import('@/components/settings-view').then((mod) => mod.SettingsView),
  { ssr: false, loading: () => <SettingsSkeleton /> }
);

export default function SettingsPage() {
    return (
        <PageTransition>
            <DataBoundary>
                <SettingsView />
            </DataBoundary>
        </PageTransition>
    );
}
