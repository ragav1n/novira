import type { Metadata } from 'next';
import { ReceiptsView } from '@/components/receipts-view';
import { DataBoundary } from '@/components/boundaries/data-boundary';
import { PageTransition } from '@/components/page-transition';

export const metadata: Metadata = {
    title: 'Receipts',
};

export default function ReceiptsPage() {
    // DataBoundary added for parity with every other authed route — this was the
    // only one where a render error took out the whole app shell.
    return (
        <PageTransition>
            <DataBoundary>
                <ReceiptsView />
            </DataBoundary>
        </PageTransition>
    );
}
