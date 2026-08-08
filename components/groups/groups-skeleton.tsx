import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function GroupsSkeleton() {
    return (
        /* The pulse used to sit on this root. `animate-pulse` animates opacity, so
           nesting compounds it — a parent going 1→0.5 over a child going 1→0.5 troughs
           at 0.25, a visibly deeper pulse than intended. Each `Skeleton` pulses itself. */
        <div className="space-y-6" role="status" aria-label="Loading">
            {/* Net-position hero skeleton */}
            <div className="space-y-3">
                <Skeleton tone="chip" className="h-2.5 w-24 rounded" />
                <Skeleton tone="chip" className="h-10 w-40 rounded" />
                <div className="flex items-center gap-2 pt-1">
                    <Skeleton tone="chip" className="h-7 w-36 rounded-full" />
                    <Skeleton tone="chip" className="h-7 w-32 rounded-full" />
                </div>
            </div>

            {/* Tab strip skeleton */}
            <div className="h-11 border-b border-white/5 grid grid-cols-5 gap-2 px-2 items-center">
                {[0, 1, 2, 3, 4].map(i => (
                    <Skeleton key={i} tone="chip" className="h-3 rounded" />
                ))}
            </div>

            {/* Card list skeleton */}
            <div className="space-y-2">
                {[0, 1, 2].map(i => (
                    <div key={i} className="relative h-[88px] rounded-xl border border-white/10 bg-white/[0.035] overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.05),_0_4px_12px_-6px_rgba(0,0,0,0.45)]">
                        <Skeleton tone="chip" className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r" />
                        <div className="p-4 pl-[18px] flex items-center gap-3">
                            <Skeleton tone="chip" className="w-10 h-10 rounded-xl shrink-0" />
                            <div className="flex-1 space-y-2">
                                <Skeleton tone="chip" className="h-3 w-1/2 rounded" />
                                <Skeleton tone="chip" className="h-2.5 w-1/3 rounded" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
