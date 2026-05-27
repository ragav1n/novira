'use client';

import { Card, CardContent } from '@/components/ui/card';

export function AnalyticsSkeleton() {
    return (
        <div className="space-y-6">
            {/* Hero block placeholder */}
            <div className="rounded-3xl bg-gradient-to-br from-secondary/15 to-secondary/5 p-5 sm:p-6 space-y-4">
                <div className="h-3 w-40 bg-secondary/20 rounded animate-pulse" />
                <div className="h-9 w-48 bg-secondary/25 rounded-lg animate-pulse" />
                <div className="h-12 w-full bg-secondary/10 rounded-xl animate-pulse" />
                <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-12 rounded-xl bg-secondary/10 animate-pulse" />
                    ))}
                </div>
            </div>

            {/* Section: Overview */}
            <div className="space-y-2">
                <div className="h-3 w-28 bg-secondary/20 rounded animate-pulse ml-1" />
                <Card className="bg-card/40 border-white/5 shadow-none">
                    <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between">
                            <div className="h-3 w-24 bg-secondary/20 rounded animate-pulse" />
                        </div>
                        <div className="h-[160px] w-full bg-secondary/10 rounded-xl animate-pulse" />
                    </CardContent>
                </Card>
            </div>

            {/* Section: Breakdown — 2-col grid placeholder */}
            <div className="space-y-2">
                <div className="h-3 w-28 bg-secondary/20 rounded animate-pulse ml-1" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {[1, 2].map(i => (
                        <Card key={i} className="bg-card/40 border-none shadow-none overflow-hidden">
                            <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-6">
                                <div className="w-32 h-32 rounded-full border-8 border-secondary/10 animate-pulse shrink-0" />
                                <div className="w-full space-y-3">
                                    {[1, 2, 3].map(j => (
                                        <div key={j} className="space-y-2">
                                            <div className="flex justify-between">
                                                <div className="h-3 w-20 bg-secondary/20 rounded animate-pulse" />
                                                <div className="h-3 w-16 bg-secondary/20 rounded animate-pulse" />
                                            </div>
                                            <div className="h-1 w-full bg-secondary/10 rounded-full" />
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
