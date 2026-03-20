'use client';

import dynamic from 'next/dynamic';
import { DataBoundary } from '@/components/boundaries/data-boundary';

const AddExpenseView = dynamic(
    () => import('@/components/add-expense-view').then(mod => mod.AddExpenseView),
    { ssr: false }
);

export default function AddExpensePage() {
    return (
        <DataBoundary>
            <AddExpenseView />
        </DataBoundary>
    );
}
