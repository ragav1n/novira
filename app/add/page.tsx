'use client';

import dynamic from 'next/dynamic';
import { DataBoundary } from '@/components/boundaries/data-boundary';
import { PageTransition } from '@/components/page-transition';

// The centre "+" is the most-tapped control in the app. Without a loading fallback
// this route showed a blank frame while its chunk downloaded — every other dynamic
// route supplies one.
const AddExpenseSkeleton = () => (
    <div className="flex flex-col min-h-screen p-5 space-y-6 max-w-md lg:max-w-4xl mx-auto">
        <div className="flex justify-between items-center pt-2 gap-2 opacity-50">
            <div className="w-10 h-10 rounded-full bg-secondary/20 animate-pulse" />
            <div className="h-6 w-32 bg-secondary/20 rounded-lg animate-pulse" />
            <div className="w-10 h-10 rounded-full bg-secondary/20 animate-pulse" />
        </div>
        <div className="h-20 w-full rounded-3xl bg-secondary/10 animate-pulse mt-2" />
        <div className="h-12 w-full rounded-xl bg-secondary/10 animate-pulse" />
        <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-secondary/10 animate-pulse" />
            ))}
        </div>
        <div className="h-12 w-full rounded-xl bg-secondary/10 animate-pulse" />
    </div>
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
