'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin } from 'lucide-react';
import type { LocationCluster } from '@/hooks/useAnalyticsData';

interface Props {
    locationClusters: LocationCluster[];
    geoTxCount: number;
    formatCurrency: (amount: number) => string;
}

export function LocationInsightsCard({ locationClusters, geoTxCount, formatCurrency }: Props) {
    const router = useRouter();
    if (locationClusters.length === 0) return null;

    const top = locationClusters.slice(0, 5);
    const totalTop = top.reduce((s, c) => s + c.amount, 0);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80">
                    Top Spending Zones
                </span>
                <span className="text-[10px] font-bold tabular-nums text-muted-foreground/60">
                    {geoTxCount} located {geoTxCount === 1 ? 'tx' : 'txns'}
                </span>
            </div>
            <Card className="bg-card/40 border-none shadow-none backdrop-blur-md overflow-hidden">
                <CardContent className="p-3 space-y-1.5">
                    {top.map((cluster, idx) => {
                        const share = totalTop > 0 ? (cluster.amount / totalTop) * 100 : 0;
                        return (
                            <button
                                key={cluster.key}
                                onClick={() => router.push(`/search?q=${encodeURIComponent(cluster.label)}`)}
                                className="w-full flex items-center gap-3 p-2.5 rounded-2xl bg-secondary/10 border border-white/5 hover:bg-secondary/20 transition-colors text-left"
                            >
                                <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shrink-0">
                                    <MapPin className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[13px] font-bold truncate">{cluster.label}</span>
                                        <span className="text-[12px] font-bold tabular-nums shrink-0">{formatCurrency(cluster.amount)}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2 mt-0.5">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                            #{idx + 1} · {cluster.count} {cluster.count === 1 ? 'visit' : 'visits'}
                                        </span>
                                        <div className="h-1 flex-1 max-w-[80px] bg-secondary/20 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary rounded-full transition-[width] duration-700"
                                                style={{ width: `${share}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </CardContent>
            </Card>
        </div>
    );
}
