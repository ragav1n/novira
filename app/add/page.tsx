'use client';

import dynamic from 'next/dynamic';

const AddExpenseView = dynamic(
    () => import('@/components/add-expense-view').then(mod => mod.AddExpenseView),
    { ssr: false }
);

export default function AddExpensePage() {
    return <AddExpenseView />;
}
