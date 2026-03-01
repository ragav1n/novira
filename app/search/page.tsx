'use client';

import dynamic from 'next/dynamic';

const SearchSkeleton = () => (
  <div className="flex flex-col min-h-screen p-5 space-y-6 max-w-md mx-auto">
    <div className="flex justify-between items-center pt-2 gap-2 opacity-50">
      <div className="w-10 h-10 rounded-full bg-secondary/20 animate-pulse" />
      <div className="h-6 w-32 bg-secondary/20 rounded-lg animate-pulse" />
      <div className="w-10 h-10 rounded-full bg-secondary/20 animate-pulse" />
    </div>
    <div className="h-12 w-full rounded-xl bg-secondary/10 animate-pulse" />
    <div className="space-y-3 mt-4">
      <div className="h-16 w-full rounded-2xl bg-secondary/10 animate-pulse" />
      <div className="h-16 w-full rounded-2xl bg-secondary/10 animate-pulse" />
      <div className="h-16 w-full rounded-2xl bg-secondary/10 animate-pulse" />
    </div>
  </div>
);

const SearchView = dynamic(
  () => import('@/components/search-view').then((mod) => mod.SearchView),
  { ssr: false, loading: () => <SearchSkeleton /> }
);

export default function SearchPage() {
    return <SearchView />;
}
