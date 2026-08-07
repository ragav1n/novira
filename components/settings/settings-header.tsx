'use client';

import { useSafeBack } from '@/hooks/useSafeBack';
import { ViewHeader } from '@/components/ui/view-header';

export function SettingsHeader() {
    const goBack = useSafeBack('/');
    return <ViewHeader title="Settings" onBack={goBack} className="mb-6" />;
}
