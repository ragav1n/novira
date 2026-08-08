'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { DataBoundary } from '@/components/boundaries/data-boundary';
import { PageTransition } from '@/components/page-transition';

const SearchSkeleton = () => (
  <PageSkeleton width="2xl" title="w-32">
    <Skeleton className="h-12 w-full rounded-xl" />
    <div className="space-y-3 mt-4">
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
    </div>
  </PageSkeleton>
);

const SearchView = dynamic(
  () => import('@/components/search-view').then((mod) => mod.SearchView),
  { ssr: false, loading: () => <SearchSkeleton /> }
);

export default function SearchPage() {
    return (
        <PageTransition>
            <DataBoundary onReset={() => window.location.reload()}>
                <SearchView />
            </DataBoundary>
        </PageTransition>
    );
}
