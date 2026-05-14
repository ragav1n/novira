'use client';

import React, { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plane } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TripsTabContent } from '@/components/groups/trips-tab-content';

export function TripsView() {
    const router = useRouter();

    const handleBack = useCallback(() => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
            router.back();
        } else {
            router.push('/groups?tab=trips');
        }
    }, [router]);

    return (
        <div className="flex flex-col min-h-screen p-5 space-y-6 max-w-md mx-auto pb-32">
            <div className="flex items-center justify-between pt-2 gap-3">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleBack}
                    aria-label="Go back"
                    className="rounded-full w-10 h-10"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <Plane className="w-5 h-5 text-sky-300" aria-hidden="true" />
                    Trips
                </h1>
                <div className="w-10 h-10" aria-hidden="true" />
            </div>

            <TripsTabContent />
        </div>
    );
}
