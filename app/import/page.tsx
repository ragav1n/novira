'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { DataBoundary } from '@/components/boundaries/data-boundary';
import { PageTransition } from '@/components/page-transition';

const ImportSkeleton = () => (
  <PageSkeleton width="2xl" title="w-32">
    <Skeleton className="h-[200px] w-full rounded-3xl" />
    <div className="space-y-3 mt-4">
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
    </div>
  </PageSkeleton>
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
