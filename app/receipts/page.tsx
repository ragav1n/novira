import type { Metadata } from 'next';
import { ReceiptsView } from '@/components/receipts-view';
import { PageTransition } from '@/components/page-transition';

export const metadata: Metadata = {
    title: 'Receipts',
};

export default function ReceiptsPage() {
    return (
        <PageTransition>
            <ReceiptsView />
        </PageTransition>
    );
}
