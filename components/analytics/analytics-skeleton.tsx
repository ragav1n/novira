'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function AnalyticsSkeleton() {
    return (
        <div className="space-y-6" role="status" aria-label="Loading analytics">
            {/* Hero block placeholder */}
            <div className="rounded-3xl bg-gradient-to-br from-secondary/15 to-secondary/5 p-5 sm:p-6 space-y-4">
                <Skeleton tone="chip" className="h-3 w-40 rounded" />
                <Skeleton tone="chip" className="h-9 w-48 rounded-lg" />
                <Skeleton className="h-12 w-full rounded-xl" />
                <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map(i => (
                        <Skeleton key={i} className="h-12 rounded-xl" />
                    ))}
                </div>
            </div>

            {/* Section: Overview */}
            <div className="space-y-2">
                <Skeleton tone="chip" className="h-3 w-28 rounded ml-1" />
                <Card className="bg-card/40 border-white/5 shadow-none">
                    <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between">
                            <Skeleton tone="chip" className="h-3 w-24 rounded" />
                        </div>
                        <Skeleton className="h-[160px] w-full rounded-xl" />
                    </CardContent>
                </Card>
            </div>

            {/* Section: Breakdown — 2-col grid placeholder */}
            <div className="space-y-2">
                <Skeleton tone="chip" className="h-3 w-28 rounded ml-1" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {[1, 2].map(i => (
                        <Card key={i} className="bg-card/40 border-none shadow-none overflow-hidden">
                            <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-6">
                                {/* Donut placeholder: the ring is the border, so the fill stays
                                    transparent — only the pulse comes from the primitive. */}
                                <Skeleton className="w-32 h-32 rounded-full border-8 border-secondary/10 bg-transparent shrink-0" />
                                <div className="w-full space-y-3">
                                    {[1, 2, 3].map(j => (
                                        <div key={j} className="space-y-2">
                                            <div className="flex justify-between">
                                                <Skeleton tone="chip" className="h-3 w-20 rounded" />
                                                <Skeleton tone="chip" className="h-3 w-16 rounded" />
                                            </div>
                                            <Skeleton className="h-1 w-full rounded-full" />
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
