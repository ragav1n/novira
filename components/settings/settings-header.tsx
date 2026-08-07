'use client';

import { ChevronLeft } from 'lucide-react';
import { useSafeBack } from '@/hooks/useSafeBack';

export function SettingsHeader() {
    const goBack = useSafeBack('/');
    return (
        <div className="flex items-center justify-between mb-6 relative min-h-[40px]">
            <button
                onClick={goBack}
                aria-label="Go back"
                className="min-h-[44px] min-w-[44px] -m-1 inline-flex items-center justify-center rounded-full bg-secondary/30 hover:bg-secondary/50 transition-colors shrink-0 z-10"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <h2 className="text-lg font-semibold truncate px-12">Settings</h2>
            </div>
            <div className="w-9 shrink-0 z-10" />
        </div>
    );
}
