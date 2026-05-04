'use client';

import { Card, CardContent } from '@/components/ui/card';

export function AnalyticsSkeleton() {
    return (
        <div className="space-y-6">
            <div className="flex gap-2 px-1">
                <div className="flex-1 h-10 rounded-xl bg-secondary/10 animate-pulse" />
                <div className="flex-1 h-10 rounded-xl bg-secondary/10 animate-pulse" />
            </div>

            <Card className="bg-card/40 border-white/5 shadow-none">
                <CardContent className="p-4 space-y-4">
                    <div className="flex justify-between">
                        <div className="h-4 w-24 bg-secondary/20 rounded animate-pulse" />
                        <div className="h-4 w-12 bg-secondary/20 rounded animate-pulse" />
                    </div>
                    <div className="h-[140px] w-full bg-secondary/10 rounded-xl animate-pulse" />
                    <div className="pt-2 border-t border-white/5 flex justify-between">
                        <div className="h-4 w-16 bg-secondary/20 rounded animate-pulse" />
                        <div className="h-5 w-24 bg-secondary/20 rounded animate-pulse" />
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-2">
                <div className="h-3 w-32 bg-secondary/20 rounded animate-pulse ml-1" />
                <Card className="bg-card/40 border-none shadow-none overflow-hidden">
                    <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-6">
                        <div className="w-36 h-36 rounded-full border-8 border-secondary/10 animate-pulse shrink-0" />
                        <div className="w-full space-y-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="space-y-2">
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
            </div>
        </div>
    );
}
