'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export function DashboardSkeleton() {
    return (
        <div className="space-y-6 pb-20">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                    <Skeleton className="w-12 h-12 rounded-2xl" />
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-32 rounded-lg" />
                        <Skeleton className="h-4 w-24 rounded-lg" />
                    </div>
                </div>
                <div className="flex gap-2">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <Skeleton className="w-10 h-10 rounded-full" />
                </div>
            </div>

            {/* Spending Overview Skeleton */}
            <div className="space-y-6">
                {/* Focus Selector */}
                <div className="flex justify-center">
                    <Skeleton className="h-10 w-44 rounded-full" />
                </div>

                {/* Main Card */}
                <Card className="rounded-[32px] border-none overflow-hidden h-44 bg-card/30 relative">
                    <CardContent className="p-6 space-y-4">
                        <div className="flex justify-between items-start">
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-24 opacity-50" />
                                <Skeleton className="h-10 w-48" />
                            </div>
                            <Skeleton className="w-10 h-10 rounded-full opacity-50" />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <Skeleton className="h-3 w-32 opacity-50" />
                                <Skeleton className="h-3 w-24 opacity-50" />
                            </div>
                            <Skeleton className="h-2 w-full rounded-full" />
                        </div>
                    </CardContent>
                </Card>

                {/* Add Funds Button */}
                <Skeleton className="h-14 w-full rounded-[32px]" />

                {/* Charts Skeleton */}
                <div className="grid grid-cols-2 gap-4">
                    <Card className="rounded-3xl border-none h-52 bg-card/20">
                        <CardContent className="p-4 flex flex-col items-center justify-center space-y-4">
                            <Skeleton className="w-32 h-32 rounded-full" />
                            <Skeleton className="h-3 w-16" />
                        </CardContent>
                    </Card>
                    <Card className="rounded-3xl border-none h-52 bg-card/20">
                        <CardContent className="p-4 flex flex-col items-center justify-center space-y-4">
                            <Skeleton className="w-32 h-32 rounded-full" />
                            <Skeleton className="h-3 w-16" />
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Transactions Skeleton */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-16" />
                </div>
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-card/10 border border-white/5">
                        <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                        <div className="flex-1 space-y-2">
                            <div className="flex justify-between">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-4 w-16" />
                            </div>
                            <Skeleton className="h-3 w-24 opacity-50" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
