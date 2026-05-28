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

    const breakdown = useMemo(() => {
        if (!bucket) return null;
        const allowed = bucket.allowed_categories || [];

        const byCategory = new Map<string, number>();
        const byCurrency = new Map<string, { native: number; converted: number }>();
        const byMember = new Map<string, { name: string; avatar?: string; total: number }>();
        let totalConverted = 0;

        for (const tx of transactions) {
            if (allowed.length > 0 && !allowed.includes((tx.category || '').toLowerCase())) continue;

            const splits = tx.splits || [];
            const payerProfile = Array.isArray(tx.profile) ? tx.profile[0] : tx.profile;

            const txCurr = (tx.currency || 'USD').toUpperCase();
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
            <SheetContent side="right" className="w-full sm:max-w-md p-0 border-white/[0.06] bg-background overflow-y-auto">
                <SheetHeader className="px-5 pt-5 pb-3 sticky top-0 bg-background/95 backdrop-blur-2xl border-b border-white/[0.05] z-10 text-left">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-cyan-400/[0.08] text-cyan-400 p-2 shrink-0">
                            {getBucketIcon(bucket.icon)}
                        </div>
                        <div className="min-w-0 flex-1">
                            <SheetTitle className="truncate flex items-center gap-2 text-[15px] font-semibold tracking-tight">
                                {bucket.name}
                                {isCompleted && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-[0.14em] bg-emerald-400/15 text-emerald-300 border border-emerald-400/20">
                                        <Trophy className="w-2.5 h-2.5" aria-hidden="true" />
                                        Complete
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

                <div className="p-5 space-y-5">
                    {/* Progress / Completion summary */}
                    <div
                        className={cn(
                            'rounded-2xl border p-4 space-y-3',
                            isCompleted
                                ? 'bg-emerald-400/[0.05] border-emerald-400/20'
                                : 'bg-white/[0.035] border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
                        )}
                    >
                        {isCompleted ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <Flag className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                                    <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-300">Final summary</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <p className="text-[10px] text-muted-foreground/70 uppercase tracking-[0.14em]">Total spent</p>
                                        <p className="text-base font-bold tabular-nums mt-0.5">{formatCurrency(spent, bucketCurrency)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground/70 uppercase tracking-[0.14em]">Budget</p>
                                        <p className="text-base font-bold tabular-nums mt-0.5">{formatCurrency(budget, bucketCurrency)}</p>
                                    </div>
                                </div>
                                <p className={cn('text-[12px] font-semibold', overBudget ? 'text-rose-300' : 'text-emerald-300')}>
                                    {budget === 0
                                        ? `${transactions.length} transactions logged`
                                        : overBudget
                                            ? `${formatCurrency(Math.abs(remaining), bucketCurrency)} over budget`
                                            : `${formatCurrency(remaining, bucketCurrency)} under budget`}
                                </p>
                            </>
                        ) : (
                            <>
                                <div className="flex items-end justify-between gap-3">
                                    <div>
                                        <p className="text-[10px] text-muted-foreground/70 uppercase tracking-[0.14em] font-medium">Spent</p>
                                        <p className="text-2xl font-bold tabular-nums mt-1 tracking-tight">{formatCurrency(spent, bucketCurrency)}</p>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground tabular-nums mb-1">
                                        of {formatCurrency(budget, bucketCurrency)}
                                    </p>
                                </div>
                                {budget > 0 && (
                                    <div className="h-[3px] w-full bg-white/[0.04] rounded-full overflow-hidden">
                                        <div
                                            className={cn(
                                                'h-full transition-all duration-500 rounded-full',
                                                progress >= 100 ? 'bg-rose-400' : progress >= 80 ? 'bg-amber-400' : 'bg-cyan-400',
                                            )}
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {loading ? (
                        <div className="space-y-2">
                            <div className="h-20 rounded-2xl bg-secondary/10 animate-pulse" />
                            <div className="h-20 rounded-2xl bg-secondary/10 animate-pulse" />
                        </div>
                    ) : !breakdown || breakdown.totalConverted === 0 ? (
                        <div className="text-center py-10 space-y-2">
                            <div className="w-10 h-10 mx-auto rounded-full bg-secondary/15 flex items-center justify-center">
                                <Layers className="w-4 h-4 text-muted-foreground/50" aria-hidden="true" />
                            </div>
                            <p className="text-[13px] font-semibold">No spending yet</p>
                            <p className="text-[11px] text-muted-foreground px-6">
                                Tag transactions to this bucket to see them here.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Category breakdown */}
                            <section className="space-y-2.5">
                                <h4 className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60 pl-1">
                                    Top categories
                                </h4>
                                <div className="space-y-2">
                                    {breakdown.categories.slice(0, 5).map(([cat, amt]) => {
                                        const pct = breakdown.totalConverted > 0 ? (amt / breakdown.totalConverted) * 100 : 0;
                                        const color = CATEGORY_COLORS[cat] || CATEGORY_COLORS.others;
                                        return (
                                            <div key={cat} className="flex items-center gap-3">
                                                <div
                                                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                                                    style={{ backgroundColor: `${color}1F`, border: `1px solid ${color}40` }}
                                                >
                                                    {React.cloneElement(getIconForCategory(cat) as React.ReactElement<{ style?: React.CSSProperties }>, {
                                                        style: { color, width: '0.875rem', height: '0.875rem' },
                                                    })}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-baseline justify-between gap-2">
                                                        <p className="text-[12px] font-semibold capitalize truncate">{getCategoryLabel(cat)}</p>
                                                        <p className="text-[12px] font-bold tabular-nums">{formatCurrency(amt, bucketCurrency)}</p>
                                                    </div>
                                                    <div className="h-[3px] w-full bg-white/[0.04] rounded-full overflow-hidden mt-1">
                                                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>

                            {breakdown.currencies.length > 1 && (
                                <section className="space-y-2.5">
                                    <h4 className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60 pl-1">
                                        By currency
                                    </h4>
                                    <div className="rounded-2xl border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
                                        {breakdown.currencies.map(([curr, totals]) => (
                                            <div key={curr} className="flex items-center justify-between px-3 py-2 bg-white/[0.025]">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-secondary/30 tabular-nums">{curr}</span>
                                                    <span className="text-[13px] font-semibold tabular-nums">{formatCurrency(totals.native, curr)}</span>
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

                            {isGroupBucket && breakdown.members.length > 1 && (
                                <section className="space-y-2.5">
                                    <h4 className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60 pl-1">
                                        By member
                                    </h4>
                                    <div className="space-y-2">
                                        {breakdown.members.map(([uid, m]) => {
                                            const pct = breakdown.totalConverted > 0 ? (m.total / breakdown.totalConverted) * 100 : 0;
                                            return (
                                                <div key={uid} className="flex items-center gap-3">
                                                    <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 overflow-hidden">
                                                        {m.avatar ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img src={m.avatar} alt="" width={28} height={28} className="w-full h-full object-cover" />
                                                        ) : (
                                                            m.name.charAt(0).toUpperCase()
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-baseline justify-between gap-2">
                                                            <p className="text-[12px] font-semibold truncate">{m.name}</p>
                                                            <p className="text-[12px] font-bold tabular-nums">{formatCurrency(m.total, bucketCurrency)}</p>
                                                        </div>
                                                        <div className="h-[3px] w-full bg-white/[0.04] rounded-full overflow-hidden mt-1">
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
                                <h4 className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60 pl-1">
                                    {transactions.length} transaction{transactions.length === 1 ? '' : 's'}
                                </h4>
                                <ul className="rounded-2xl border border-white/[0.06] overflow-hidden divide-y divide-white/[0.04]">
                                    {transactions.slice(0, 50).map((tx) => {
                                        const color = CATEGORY_COLORS[(tx.category || '').toLowerCase()] || CATEGORY_COLORS.others;
                                        return (
                                            <li key={tx.id} className="flex items-center gap-3 px-3 py-2 bg-white/[0.025]">
                                                <div
                                                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                                                    style={{ backgroundColor: `${color}1F` }}
                                                >
                                                    {React.cloneElement(getIconForCategory(tx.category) as React.ReactElement<{ style?: React.CSSProperties }>, {
                                                        style: { color, width: '0.75rem', height: '0.75rem' },
                                                    })}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[13px] font-semibold truncate">{tx.description}</p>
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
                                                <p className="text-[12px] font-bold tabular-nums shrink-0">
                                                    {formatCurrency(Number(tx.amount), tx.currency || bucketCurrency)}
                                                </p>
                                            </li>
                                        );
                                    })}
                                    {transactions.length > 50 && (
                                        <li className="px-3 py-2 text-center text-[11px] text-muted-foreground bg-white/[0.025]">
                                            Showing 50 of {transactions.length}
                                        </li>
                                    )}
                                </ul>
                            </section>
                        </>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
