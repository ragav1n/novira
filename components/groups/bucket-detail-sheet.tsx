'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CATEGORY_COLORS, getCategoryLabel, getIconForCategory } from '@/lib/categories';
import { getBucketIcon } from '@/utils/icon-utils';
import { BucketService } from '@/lib/services/bucket-service';
import { Bucket } from '@/components/providers/buckets-provider';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { Trophy, Flag, MapPin, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

type ProfileLite = { full_name: string; avatar_url?: string };
type DetailTx = {
    id: string;
    description: string;
    amount: number;
    category: string;
    date: string;
    user_id: string;
    currency: string | null;
    exchange_rate: number | null;
    base_currency: string | null;
    place_name?: string | null;
    profile?: ProfileLite | ProfileLite[] | null;
    splits?: {
        user_id: string;
        amount: number;
        is_paid?: boolean;
        profile?: ProfileLite | ProfileLite[] | null;
    }[];
};

interface Props {
    bucket: Bucket | null;
    spent: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function BucketDetailSheet({ bucket, spent, open, onOpenChange }: Props) {
    const { formatCurrency, convertAmount, currency } = useUserPreferences();
    const [transactions, setTransactions] = useState<DetailTx[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open || !bucket) return;
        let cancelled = false;
        setLoading(true);
        (async () => {
            try {
                const data = await BucketService.getBucketTransactions(bucket.id);
                if (!cancelled) setTransactions((data || []) as DetailTx[]);
            } catch (error) {
                console.error('Error fetching bucket transactions:', error);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [open, bucket]);

    const bucketCurrency = (bucket?.currency || currency).toUpperCase();
    const isCompleted = !!bucket?.completed_at;

    // Per-category, per-currency, and per-member breakdowns. All converted into the
    // bucket's currency so totals are comparable; the per-currency view keeps the
    // original currencies for users tracking mixed-currency trips.
    const breakdown = useMemo(() => {
        if (!bucket) return null;
        const allowed = bucket.allowed_categories || [];

        const byCategory = new Map<string, number>();
        const byCurrency = new Map<string, { native: number; converted: number }>();
        const byMember = new Map<string, { name: string; avatar?: string; total: number }>();
        let totalConverted = 0;

        for (const tx of transactions) {
            if (allowed.length > 0 && !allowed.includes((tx.category || '').toLowerCase())) continue;

            // Per-user share, mirrors computeBucketSpending.
            const splits = tx.splits || [];
            const payerProfile = Array.isArray(tx.profile) ? tx.profile[0] : tx.profile;

            const txCurr = (tx.currency || 'USD').toUpperCase();
            // Split-aware contribution: payer keeps amount minus what others owe;
            // each split user contributes their own amount to the bucket total.
            const contributors: Array<{ user_id: string; native: number; profile?: ProfileLite | null }> = [];
            if (splits.length > 0) {
                const othersOwe = splits.reduce((s, x) => s + Number(x.amount || 0), 0);
                const payerShare = Number(tx.amount) - othersOwe;
                if (payerShare > 0) contributors.push({ user_id: tx.user_id, native: payerShare, profile: payerProfile });
                for (const s of splits) {
                    if (Number(s.amount) > 0) {
                        const sProfile = Array.isArray(s.profile) ? s.profile[0] : s.profile;
                        contributors.push({ user_id: s.user_id, native: Number(s.amount), profile: sProfile });
                    }
                }
            } else {
                contributors.push({ user_id: tx.user_id, native: Number(tx.amount), profile: payerProfile });
            }

            // Conversion: prefer the stored exchange_rate when base matches the
            // bucket's currency, else fall back to live rate.
            let toBucket: (n: number) => number;
            if (txCurr === bucketCurrency) {
                toBucket = (n) => n;
            } else if (tx.exchange_rate && (tx.base_currency || '').toUpperCase() === bucketCurrency) {
                toBucket = (n) => n * Number(tx.exchange_rate);
            } else {
                toBucket = (n) => convertAmount(n, txCurr, bucketCurrency);
            }

            for (const c of contributors) {
                const conv = toBucket(c.native);
                totalConverted += conv;

                const catKey = (tx.category || 'others').toLowerCase();
                byCategory.set(catKey, (byCategory.get(catKey) || 0) + conv);

                const currEntry = byCurrency.get(txCurr) || { native: 0, converted: 0 };
                currEntry.native += c.native;
                currEntry.converted += conv;
                byCurrency.set(txCurr, currEntry);

                const memberName = c.profile?.full_name || `User ${c.user_id.slice(0, 6)}`;
                const memberAvatar = c.profile?.avatar_url;
                const m = byMember.get(c.user_id) || { name: memberName, avatar: memberAvatar, total: 0 };
                if (c.profile?.full_name) {
                    m.name = c.profile.full_name;
                    m.avatar = c.profile.avatar_url;
                }
                m.total += conv;
                byMember.set(c.user_id, m);
            }
        }

        return {
            totalConverted,
            categories: [...byCategory.entries()].sort((a, b) => b[1] - a[1]),
            currencies: [...byCurrency.entries()].sort((a, b) => b[1].converted - a[1].converted),
            members: [...byMember.entries()].sort((a, b) => b[1].total - a[1].total),
        };
    }, [transactions, bucket, bucketCurrency, convertAmount]);

    if (!bucket) return null;

    const budget = Number(bucket.budget) || 0;
    const progress = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
    const remaining = budget - spent;
    const overBudget = remaining < 0;

    const isGroupBucket = !!bucket.group_id;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full sm:max-w-md p-0 border-white/5 bg-background overflow-y-auto">
                <SheetHeader className="p-6 pb-3 sticky top-0 bg-background/95 backdrop-blur-xl border-b border-white/5 z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 p-2.5 shrink-0">
                            {getBucketIcon(bucket.icon)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <SheetTitle className="truncate flex items-center gap-2">
                                {bucket.name}
                                {isCompleted && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                                        <Trophy className="w-2.5 h-2.5" aria-hidden="true" />
                                        Completed
                                    </span>
                                )}
                            </SheetTitle>
                            <SheetDescription className="text-[11px] mt-0.5">
                                {bucket.start_date && bucket.end_date
                                    ? `${format(parseISO(bucket.start_date.slice(0, 10)), 'MMM d')} – ${format(parseISO(bucket.end_date.slice(0, 10)), 'MMM d, yyyy')}`
                                    : 'Active bucket'}
                            </SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                <div className="p-6 space-y-6">
                    {/* Progress / Completion summary */}
                    <div className={cn(
                        "rounded-2xl border p-4 space-y-3",
                        isCompleted ? "bg-emerald-500/5 border-emerald-500/20" : "bg-card/40 border-white/5"
                    )}>
                        {isCompleted ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <Flag className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                                    <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-300">Final summary</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Total spent</p>
                                        <p className="font-bold text-base mt-0.5">{formatCurrency(spent, bucketCurrency)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Budget</p>
                                        <p className="font-bold text-base mt-0.5">{formatCurrency(budget, bucketCurrency)}</p>
                                    </div>
                                </div>
                                <p className={cn("text-xs font-semibold", overBudget ? "text-rose-400" : "text-emerald-400")}>
                                    {budget === 0
                                        ? `${transactions.length} transactions logged`
                                        : overBudget
                                            ? `${formatCurrency(Math.abs(remaining), bucketCurrency)} over budget`
                                            : `${formatCurrency(remaining, bucketCurrency)} under budget`}
                                </p>
                            </>
                        ) : (
                            <>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Spent</p>
                                        <p className="font-bold text-xl mt-0.5">{formatCurrency(spent, bucketCurrency)}</p>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                        of {formatCurrency(budget, bucketCurrency)}
                                    </p>
                                </div>
                                {budget > 0 && (
                                    <div className="h-1.5 w-full bg-secondary/20 rounded-full overflow-hidden">
                                        <div
                                            className={cn(
                                                "h-full transition-all duration-500",
                                                progress >= 100 ? "bg-rose-500" : progress >= 80 ? "bg-amber-500" : "bg-cyan-500"
                                            )}
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {loading ? (
                        <div className="space-y-3">
                            <div className="h-24 rounded-2xl bg-secondary/10 animate-pulse" />
                            <div className="h-24 rounded-2xl bg-secondary/10 animate-pulse" />
                        </div>
                    ) : !breakdown || breakdown.totalConverted === 0 ? (
                        <div className="text-center py-12 space-y-2">
                            <div className="w-12 h-12 mx-auto rounded-full bg-secondary/20 flex items-center justify-center">
                                <Layers className="w-5 h-5 text-muted-foreground/50" aria-hidden="true" />
                            </div>
                            <p className="text-sm font-semibold">No spending yet</p>
                            <p className="text-[11px] text-muted-foreground px-6">
                                Tag transactions to this bucket to see them here.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Category breakdown */}
                            <section className="space-y-2.5">
                                <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Top categories</h4>
                                <div className="space-y-2">
                                    {breakdown.categories.slice(0, 5).map(([cat, amt]) => {
                                        const pct = breakdown.totalConverted > 0 ? (amt / breakdown.totalConverted) * 100 : 0;
                                        const color = CATEGORY_COLORS[cat] || CATEGORY_COLORS.others;
                                        return (
                                            <div key={cat} className="flex items-center gap-3">
                                                <div
                                                    className="w-8 h-8 rounded-full flex items-center justify-center border shrink-0"
                                                    style={{ backgroundColor: `${color}20`, borderColor: `${color}40` }}
                                                >
                                                    {React.cloneElement(getIconForCategory(cat) as React.ReactElement<{ style?: React.CSSProperties }>, {
                                                        style: { color, width: '0.875rem', height: '0.875rem' }
                                                    })}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-baseline justify-between gap-2">
                                                        <p className="text-xs font-semibold capitalize truncate">{getCategoryLabel(cat)}</p>
                                                        <p className="text-xs font-bold tabular-nums">{formatCurrency(amt, bucketCurrency)}</p>
                                                    </div>
                                                    <div className="h-1 w-full bg-secondary/20 rounded-full overflow-hidden mt-1">
                                                        <div
                                                            className="h-full rounded-full"
                                                            style={{ width: `${pct}%`, backgroundColor: color }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>

                            {/* Per-currency — only useful when at least 2 currencies are involved */}
                            {breakdown.currencies.length > 1 && (
                                <section className="space-y-2.5">
                                    <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest pl-1">By currency</h4>
                                    <div className="rounded-2xl border border-white/5 bg-card/40 divide-y divide-white/5">
                                        {breakdown.currencies.map(([curr, totals]) => (
                                            <div key={curr} className="flex items-center justify-between px-3 py-2.5 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-secondary/30 tabular-nums">{curr}</span>
                                                    <span className="font-semibold tabular-nums">{formatCurrency(totals.native, curr)}</span>
                                                </div>
                                                {curr !== bucketCurrency && (
                                                    <span className="text-[11px] text-muted-foreground tabular-nums">
                                                        ≈ {formatCurrency(totals.converted, bucketCurrency)}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Per-member — only when a group bucket has more than one contributor */}
                            {isGroupBucket && breakdown.members.length > 1 && (
                                <section className="space-y-2.5">
                                    <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest pl-1">By member</h4>
                                    <div className="space-y-2">
                                        {breakdown.members.map(([uid, m]) => {
                                            const pct = breakdown.totalConverted > 0 ? (m.total / breakdown.totalConverted) * 100 : 0;
                                            return (
                                                <div key={uid} className="flex items-center gap-3">
                                                    <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-[11px] font-bold text-primary shrink-0 overflow-hidden">
                                                        {m.avatar ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img src={m.avatar} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            m.name.charAt(0).toUpperCase()
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-baseline justify-between gap-2">
                                                            <p className="text-xs font-semibold truncate">{m.name}</p>
                                                            <p className="text-xs font-bold tabular-nums">{formatCurrency(m.total, bucketCurrency)}</p>
                                                        </div>
                                                        <div className="h-1 w-full bg-secondary/20 rounded-full overflow-hidden mt-1">
                                                            <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}

                            {/* Transaction list */}
                            <section className="space-y-2.5">
                                <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest pl-1">
                                    {transactions.length} transaction{transactions.length === 1 ? '' : 's'}
                                </h4>
                                <div className="space-y-1.5">
                                    {transactions.slice(0, 50).map((tx) => {
                                        const color = CATEGORY_COLORS[(tx.category || '').toLowerCase()] || CATEGORY_COLORS.others;
                                        return (
                                            <div key={tx.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-card/30 border border-white/5">
                                                <div
                                                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                                                    style={{ backgroundColor: `${color}20` }}
                                                >
                                                    {React.cloneElement(getIconForCategory(tx.category) as React.ReactElement<{ style?: React.CSSProperties }>, {
                                                        style: { color, width: '0.875rem', height: '0.875rem' }
                                                    })}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold truncate">{tx.description}</p>
                                                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                        {format(parseISO(tx.date.slice(0, 10)), 'MMM d')}
                                                        {tx.place_name && (
                                                            <>
                                                                <span className="opacity-50">·</span>
                                                                <MapPin className="w-2.5 h-2.5" aria-hidden="true" />
                                                                <span className="truncate">{tx.place_name}</span>
                                                            </>
                                                        )}
                                                    </p>
                                                </div>
                                                <p className="text-xs font-bold tabular-nums shrink-0">
                                                    {formatCurrency(Number(tx.amount), tx.currency || bucketCurrency)}
                                                </p>
                                            </div>
                                        );
                                    })}
                                    {transactions.length > 50 && (
                                        <p className="text-center text-[11px] text-muted-foreground pt-2">
                                            Showing 50 of {transactions.length} — open Search with this bucket to see all.
                                        </p>
                                    )}
                                </div>
                            </section>
                        </>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
