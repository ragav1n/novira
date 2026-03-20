'use client';

import { SettingsView } from '@/components/settings-view';
import { DataBoundary } from '@/components/boundaries/data-boundary';

export default function SettingsPage() {
    return (
        <DataBoundary>
            <SettingsView />
        </DataBoundary>
    );
}
