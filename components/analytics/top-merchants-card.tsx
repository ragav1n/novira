'use client';

import { memo } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

type Merchant = { name: string; count: number; amount: number };

interface Props {
    topMerchants: Merchant[];
    newMerchantsCount: number;
    formatCurrency: (amount: number) => string;
}

function TopMerchantsCardInner({ topMerchants, newMerchantsCount, formatCurrency }: Props) {
    const router = useRouter();
    if (topMerchants.length === 0) return null;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
                <span className="text-meta font-bold uppercase tracking-widest text-muted-foreground/80">
                    Top Places
                </span>
                {newMerchantsCount > 0 && (
                    <span className="text-eyebrow uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300">
                        {newMerchantsCount} new
                    </span>
                )}
            </div>
            <Card className="bg-card/20 border-none shadow-none overflow-hidden">
                <CardContent className="p-3 space-y-2">
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
                                <span className="text-caption font-bold text-muted-foreground/70 tabular-nums">{i + 1}</span>
                            </div>
                            <MapPin className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold truncate">{m.name}</p>
                                <p className="text-eyebrow uppercase text-muted-foreground/60">
                                    {m.count} {m.count === 1 ? 'visit' : 'visits'}
                                </p>
                            </div>
                            <span className="text-xs font-bold tabular-nums">{formatCurrency(m.amount)}</span>
                        </button>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}

export const TopMerchantsCard = memo(TopMerchantsCardInner);
