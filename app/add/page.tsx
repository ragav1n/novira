'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { DataBoundary } from '@/components/boundaries/data-boundary';
import { PageTransition } from '@/components/page-transition';

// The centre "+" is the most-tapped control in the app. Without a loading fallback
// this route showed a blank frame while its chunk downloaded — every other dynamic
// route supplies one.
const AddExpenseSkeleton = () => (
    <PageSkeleton width="4xl" title="w-32">
        <Skeleton className="h-20 w-full rounded-3xl mt-2" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
    </PageSkeleton>
);

const AddExpenseView = dynamic(
    () => import('@/components/add-expense-view').then(mod => mod.AddExpenseView),
    { ssr: false, loading: () => <AddExpenseSkeleton /> }
);

export default function AddExpensePage() {
    return (
        <PageTransition>
            <DataBoundary>
                <AddExpenseView />
            </DataBoundary>
        </PageTransition>
    );
}
