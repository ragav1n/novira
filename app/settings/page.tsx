'use client';

import dynamic from 'next/dynamic';
import { DataBoundary } from '@/components/boundaries/data-boundary';

const SettingsSkeleton = () => (
  <div className="flex flex-col min-h-screen p-5 space-y-6 max-w-md mx-auto">
    <div className="flex justify-between items-center pt-2 gap-2 opacity-50">
      <div className="w-10 h-10 rounded-full bg-secondary/20 animate-pulse" />
      <div className="h-6 w-32 bg-secondary/20 rounded-lg animate-pulse" />
    </div>
    <div className="space-y-4 mt-4">
      <div className="h-14 w-full rounded-2xl bg-secondary/10 animate-pulse" />
      <div className="h-14 w-full rounded-2xl bg-secondary/10 animate-pulse" />
      <div className="h-14 w-full rounded-2xl bg-secondary/10 animate-pulse" />
      <div className="h-14 w-full rounded-2xl bg-secondary/10 animate-pulse" />
    </div>
  </div>
);

const SettingsView = dynamic(
  () => import('@/components/settings-view').then((mod) => mod.SettingsView),
  { ssr: false, loading: () => <SettingsSkeleton /> }
);

export default function SettingsPage() {
    return (
        <DataBoundary>
            <SettingsView />
        </DataBoundary>
    );
}
