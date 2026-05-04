'use client';

import { useRouter } from 'next/navigation';
import { MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

type Merchant = { name: string; count: number; amount: number };

interface Props {
    topMerchants: Merchant[];
    newMerchantsCount: number;
    formatCurrency: (amount: number) => string;
}

export function TopMerchantsCard({ topMerchants, newMerchantsCount, formatCurrency }: Props) {
    const router = useRouter();
    if (topMerchants.length === 0) return null;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80">
                    Top Places
                </span>
                {newMerchantsCount > 0 && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300">
                        {newMerchantsCount} new
                    </span>
                )}
            </div>
            <Card className="bg-card/40 border-none shadow-none backdrop-blur-md overflow-hidden">
                <CardContent className="p-4 space-y-2.5">
                    {topMerchants.map((m, i) => (
                        <button
                            key={m.name}
                            onClick={() => {
                                const params = new URLSearchParams({ q: m.name });
                                router.push(`/search?${params.toString()}`);
                            }}
                            className="w-full flex items-center gap-3 text-left rounded-lg -mx-1 px-1 py-1 hover:bg-white/5 transition-colors"
                        >
                            <div className="w-6 h-6 rounded-lg bg-secondary/20 border border-white/5 flex items-center justify-center shrink-0">
                                <span className="text-[10px] font-bold text-muted-foreground/70 tabular-nums">{i + 1}</span>
                            </div>
                            <MapPin className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-bold truncate">{m.name}</p>
                                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60">
                                    {m.count} {m.count === 1 ? 'visit' : 'visits'}
                                </p>
                            </div>
                            <span className="text-[12px] font-bold tabular-nums">{formatCurrency(m.amount)}</span>
                        </button>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
