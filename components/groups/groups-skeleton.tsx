import React from 'react';

export function GroupsSkeleton() {
    return (
        <div className="space-y-7 animate-pulse" role="status" aria-label="Loading">
            {/* Net-position hero skeleton */}
            <div className="space-y-3">
                <div className="h-2.5 w-24 rounded bg-secondary/30" />
                <div className="h-10 w-40 rounded bg-secondary/40" />
                <div className="flex items-center gap-2 pt-1">
                    <div className="h-7 w-36 rounded-full bg-secondary/25" />
                    <div className="h-7 w-32 rounded-full bg-secondary/25" />
                </div>
            </div>

            {/* Tab strip skeleton */}
            <div className="h-11 border-b border-white/[0.05] grid grid-cols-5 gap-2 px-2 items-center">
                {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} className="h-3 rounded bg-secondary/30" />
                ))}
            </div>

            {/* Card list skeleton */}
            <div className="space-y-2">
                {[0, 1, 2].map(i => (
                    <div key={i} className="relative h-[88px] rounded-2xl border border-white/10 bg-white/[0.035] overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.05),_0_4px_12px_-6px_rgba(0,0,0,0.45)]">
                        <span className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r bg-secondary/40" />
                        <div className="p-4 pl-[18px] flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-secondary/25 shrink-0" />
                            <div className="flex-1 space-y-2">
                                <div className="h-3 w-1/2 rounded bg-secondary/30" />
                                <div className="h-2.5 w-1/3 rounded bg-secondary/20" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
