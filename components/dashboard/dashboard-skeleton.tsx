'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export function DashboardSkeleton() {
    return (
        <div className="space-y-6 pb-20" role="status" aria-label="Loading">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between pt-2 pb-4">
                <div className="flex items-center gap-2">
                    <Skeleton tone="chip" className="w-10 h-10 rounded-full" />
                    <div className="space-y-1">
                        <Skeleton tone="chip" className="h-5 w-32 rounded-lg" />
                        <Skeleton tone="block" className="h-3 w-24 rounded-lg" />
                    </div>
                </div>
                <div className="flex gap-2">
                    <Skeleton tone="chip" className="w-10 h-10 rounded-full" />
                    <Skeleton tone="chip" className="w-10 h-10 rounded-full" />
                    <Skeleton tone="chip" className="w-10 h-10 rounded-full" />
                </div>
            </div>

            {/* Spending Overview Skeleton */}
            <div className="space-y-6">
                {/* Focus Selector */}
                <div className="flex justify-center">
                    <Skeleton tone="chip" className="h-10 w-44 rounded-full" />
                </div>

                {/* Main Card */}
                <Card className="rounded-[2rem] border-none overflow-hidden h-44 bg-card/30 relative">
                    <CardContent className="p-6 space-y-4">
                        <div className="flex justify-between items-start">
                            <div className="space-y-2">
                                <Skeleton tone="block" className="h-4 w-24" />
                                <Skeleton tone="chip" className="h-10 w-48" />
                            </div>
                            <Skeleton tone="block" className="w-10 h-10 rounded-full" />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <Skeleton tone="block" className="h-3 w-32" />
                                <Skeleton tone="block" className="h-3 w-24" />
                            </div>
                            <Skeleton tone="chip" className="h-2 w-full rounded-full" />
                        </div>
                    </CardContent>
                </Card>

                {/* Add Funds Button */}
                <Skeleton tone="chip" className="h-14 w-full rounded-[2rem]" />

                {/* Charts Skeleton */}
                <div className="grid grid-cols-2 gap-4">
                    <Card className="rounded-3xl border-none h-52 bg-card/20">
                        <CardContent className="p-4 flex flex-col items-center justify-center space-y-4">
                            <Skeleton tone="chip" className="w-32 h-32 rounded-full" />
                            <Skeleton tone="chip" className="h-3 w-16" />
                        </CardContent>
                    </Card>
                    <Card className="rounded-3xl border-none h-52 bg-card/20">
                        <CardContent className="p-4 flex flex-col items-center justify-center space-y-4">
                            <Skeleton tone="chip" className="w-32 h-32 rounded-full" />
                            <Skeleton tone="chip" className="h-3 w-16" />
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Transactions Skeleton */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <Skeleton tone="chip" className="h-6 w-32" />
                    <Skeleton tone="chip" className="h-4 w-16" />
                </div>
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-card/10 border border-white/5">
                        <Skeleton tone="chip" className="w-10 h-10 rounded-full shrink-0" />
                        <div className="flex-1 space-y-2">
                            <div className="flex justify-between">
                                <Skeleton tone="chip" className="h-4 w-32" />
                                <Skeleton tone="chip" className="h-4 w-16" />
                            </div>
                            <Skeleton tone="block" className="h-3 w-24" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
