import { ImportView } from '@/components/import-view';
import { DataBoundary } from '@/components/boundaries/data-boundary';

export default function ImportPage() {
    return (
        <main className="min-h-screen pb-20">
            <DataBoundary>
                <ImportView />
            </DataBoundary>
        </main>
    );
}
