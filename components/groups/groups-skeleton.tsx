import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

export function GroupsSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-2 gap-4">
                <Card className="bg-card/40 border-white/5 rounded-3xl">
                    <CardContent className="p-4 h-24" />
                </Card>
                <Card className="bg-card/40 border-white/5 rounded-3xl">
                    <CardContent className="p-4 h-24" />
                </Card>
            </div>
            <div className="h-12 rounded-2xl bg-secondary/30" />
            <div className="space-y-4 mt-6">
                {[0, 1].map((i) => (
                    <Card key={i} className="bg-card/40 border-white/5 rounded-3xl">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-secondary/40 shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 w-1/2 rounded bg-secondary/40" />
                                    <div className="h-3 w-1/3 rounded bg-secondary/30" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
