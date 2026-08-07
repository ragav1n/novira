'use client';

import dynamic from 'next/dynamic';
import { DataBoundary } from '@/components/boundaries/data-boundary';
import { PageTransition } from '@/components/page-transition';

const ImportSkeleton = () => (
  <div className="flex flex-col min-h-screen p-5 space-y-6 max-w-md lg:max-w-2xl mx-auto">
    <div className="flex justify-between items-center pt-2 gap-2 opacity-50">
      <div className="w-10 h-10 rounded-full bg-secondary/20 animate-pulse" />
      <div className="h-6 w-32 bg-secondary/20 rounded-lg animate-pulse" />
      <div className="w-10 h-10 rounded-full bg-secondary/20 animate-pulse" />
    </div>
    <div className="h-[200px] w-full rounded-3xl bg-secondary/10 animate-pulse" />
    <div className="space-y-3 mt-4">
      <div className="h-16 w-full rounded-xl bg-secondary/10 animate-pulse" />
      <div className="h-16 w-full rounded-xl bg-secondary/10 animate-pulse" />
    </div>
  </div>
);

const ImportView = dynamic(
  () => import('@/components/import-view').then((mod) => mod.ImportView),
  { ssr: false, loading: () => <ImportSkeleton /> }
);

export default function ImportPage() {
    return (
        <PageTransition>
            {/* A plain div, like every other route. This was a second <main> nested
                inside mobile-layout's <main id="main-content">, which is invalid HTML
                and exposed two `main` landmarks to screen readers. */}
            <div className="min-h-screen pb-20">
                <DataBoundary>
                    <ImportView />
                </DataBoundary>
            </div>
        </PageTransition>
    );
}
