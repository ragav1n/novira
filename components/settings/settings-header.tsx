'use client';

import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function SettingsHeader() {
    const router = useRouter();
    return (
        <div className="flex items-center justify-between mb-6 relative min-h-[40px]">
            <button
                onClick={() => router.back()}
                aria-label="Go back"
                className="p-2 rounded-full bg-secondary/30 hover:bg-secondary/50 transition-colors shrink-0 z-10"
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
