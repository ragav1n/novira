'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { ArrowRight, Plus, Home, Plane, Heart, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast } from '@/utils/haptics';
import { simplifyDebtsForGroup, type SimplifiedPayment } from '@/utils/simplify-debts';
import { EmptyState } from '@/components/ui/empty-state';
import type { Group, Split } from '@/components/providers/groups-provider';

interface GroupDetailSheetProps {
    group: Group;
    currentUserId: string | null;
    pendingSplits: Split[];
    currency: string;
    formatCurrency: (amount: number, currencyCode?: string) => string;
    convertAmount: (amount: number, fromCurrency: string, toCurrency?: string) => number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface RecentTransaction {
    id: string;
    description: string;
    amount: number;
    currency: string;
    date: string;
    user_id: string;
    payer_name: string;
}

const TYPE_TOKENS = {
    home: { icon: Home, bg: 'bg-emerald-400/[0.08]', text: 'text-emerald-400' },
    trip: { icon: Plane, bg: 'bg-sky-400/[0.08]', text: 'text-sky-400' },
    couple: { icon: Heart, bg: 'bg-rose-400/[0.08]', text: 'text-rose-400' },
    other: { icon: FileText, bg: 'bg-primary/[0.08]', text: 'text-primary' },
} as const;

export function GroupDetailSheet({
    group, currentUserId, pendingSplits, currency, formatCurrency, convertAmount, open, onOpenChange,
}: GroupDetailSheetProps) {
    const router = useRouter();
    const [transactions, setTransactions] = useState<RecentTransaction[]>([]);
    const [totalSpent, setTotalSpent] = useState(0);
    const [loadingTx, setLoadingTx] = useState(false);
    const [txError, setTxError] = useState(false);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoadingTx(true);

        (async () => {
            const { data, error } = await supabase
                .from('transactions')
                .select('id, description, amount, currency, date, user_id, is_settlement, profile:profiles(full_name)')
                .eq('group_id', group.id)
                .order('date', { ascending: false })
                .limit(50);

            if (cancelled) return;
            if (error) {
                // Bailing to an empty list here rendered "No expenses yet in this group"
                // plus a confident "$0.00 total" in the header.
                console.error('[group-detail] fetch failed', error);
                setTxError(true);
                setLoadingTx(false);
                toast.error("Couldn't load this group's expenses");
                return;
            }
            setTxError(false);

            type Row = {
                id: string;
                description: string;
                amount: number;
                currency: string;
                date: string;
                user_id: string;
                is_settlement: boolean | null;
                profile?: { full_name?: string } | { full_name?: string }[] | null;
            };
            const realExpenses = (data ?? []).filter((r: Row) => r.is_settlement !== true);
            const rows: RecentTransaction[] = realExpenses.slice(0, 10).map((r: Row) => {
                const profile = Array.isArray(r.profile) ? r.profile[0] : r.profile;
                return {
                    id: r.id,
                    description: r.description,
                    amount: Number(r.amount),
                    currency: r.currency || currency,
                    date: r.date,
                    user_id: r.user_id,
                    payer_name: r.user_id === currentUserId ? 'You' : (profile?.full_name || 'Member'),
                };
            });
            setTransactions(rows);

            const { data: totals } = await supabase
                .from('transactions')
                .select('amount, currency, is_settlement')
                .eq('group_id', group.id);
            if (cancelled) return;
            type AmountRow = { amount: number; currency: string | null; is_settlement: boolean | null };
            const sum = (totals ?? [])
                .filter((t: AmountRow) => t.is_settlement !== true)
                .reduce((acc: number, t: AmountRow) => {
                    const tc = t.currency || currency;
                    return acc + (tc === currency ? Number(t.amount) : convertAmount(Number(t.amount), tc, currency));
                }, 0);
            setTotalSpent(sum);
            setLoadingTx(false);
        })();

        return () => { cancelled = true; };
    }, [open, group.id, currency, currentUserId, convertAmount]);

    const groupDebts: SimplifiedPayment[] = currentUserId
        ? simplifyDebtsForGroup(pendingSplits, currentUserId, convertAmount, currency, group.id)
        : [];

    const myPayments = groupDebts.filter(p => p.from === currentUserId);
    const myCredits = groupDebts.filter(p => p.to === currentUserId);
    const otherDebts = groupDebts.filter(p => p.from !== currentUserId && p.to !== currentUserId);

    const tokens = TYPE_TOKENS[(group.type as keyof typeof TYPE_TOKENS) || 'other'] ?? TYPE_TOKENS.other;
    const Icon = tokens.icon;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="bottom"
                className="rounded-t-[28px] border-t border-white/8 bg-card/95 backdrop-blur-2xl max-h-[88vh] overflow-y-auto p-0"
            >
                <SheetHeader className="px-5 pt-5 pb-3 text-left">
                    <div className="flex items-center gap-3">
                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', tokens.bg)}>
                            <Icon className={cn('w-[18px] h-[18px]', tokens.text)} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <SheetTitle className="truncate text-lead font-semibold tracking-tight">{group.name}</SheetTitle>
                            <SheetDescription className="text-meta mt-0.5">
                                {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                                {/* A total of 0 is a claim we can't make when the fetch failed. */}
                                {loadingTx || txError ? '' : ` · ${formatCurrency(totalSpent)} total`}
                            </SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                <div className="px-5 py-3 space-y-5">
                    {/* Per-member balance block */}
                    <section className="space-y-2">
                        <h3 className="text-eyebrow uppercase text-muted-foreground/60 px-1">
                            Who owes who
                        </h3>
                        {groupDebts.length === 0 ? (
                            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
                                <p className="text-xs text-muted-foreground">All settled in this group.</p>
                            </div>
                        ) : (
                            <ul className="space-y-1">
                                {myPayments.map((p, i) => (
                                    <DebtRow key={`me-pays-${i}`} from="You" to={p.toName} amount={formatCurrency(p.amount)} tone="negative" />
                                ))}
                                {myCredits.map((p, i) => (
                                    <DebtRow key={`me-receives-${i}`} from={p.fromName} to="You" amount={formatCurrency(p.amount)} tone="positive" />
                                ))}
                                {otherDebts.map((p, i) => (
                                    <DebtRow key={`others-${i}`} from={p.fromName} to={p.toName} amount={formatCurrency(p.amount)} tone="neutral" />
                                ))}
                            </ul>
                        )}
                    </section>

                    {/* Members */}
                    <section className="space-y-2">
                        <h3 className="text-eyebrow uppercase text-muted-foreground/60 px-1">
                            Members
                        </h3>
                        <div className="flex flex-wrap gap-1.5">
                            {group.members.map((m) => (
                                <span
                                    key={m.user_id}
                                    className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 rounded-full bg-secondary/15 border border-white/[0.06] text-meta"
                                >
                                    <Avatar className="w-4 h-4">
                                        <AvatarImage src={m.avatar_url || ''} />
                                        <AvatarFallback className="text-[7px]">{m.full_name?.substring(0, 1) || '?'}</AvatarFallback>
                                    </Avatar>
                                    {m.user_id === currentUserId ? 'You' : (m.full_name || 'Member')}
                                </span>
                            ))}
                        </div>
                    </section>

                    {/* Recent activity */}
                    <section className="space-y-2">
                        <h3 className="text-eyebrow uppercase text-muted-foreground/60 px-1">
                            Recent activity
                        </h3>
                        {loadingTx ? (
                            <div className="space-y-1.5">
                                {[0, 1, 2].map(i => (
                                    <div key={i} className="h-11 rounded-xl bg-secondary/15 animate-pulse" />
                                ))}
                            </div>
                        ) : txError ? (
                            <EmptyState variant="error" title="Couldn't load this group's expenses." />
                        ) : transactions.length === 0 ? (
                            <EmptyState title="No expenses yet in this group." />
                        ) : (
                            <ul className="rounded-xl border border-white/[0.06] overflow-hidden divide-y divide-white/[0.04]">
                                {transactions.map((tx) => (
                                    <li
                                        key={tx.id}
                                        className="flex items-center justify-between gap-3 px-3 py-2 bg-white/[0.025]"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold truncate">{tx.description || 'Expense'}</p>
                                            <p className="text-caption text-muted-foreground">
                                                {tx.payer_name} · {format(parseISO(tx.date.slice(0, 10)), 'MMM d')}
                                            </p>
                                        </div>
                                        <span className="text-xs font-bold tabular-nums whitespace-nowrap">
                                            {formatCurrency(tx.amount, tx.currency)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>

                <div className="sticky bottom-0 px-5 py-4 bg-card/95 border-t border-white/[0.06] backdrop-blur-2xl">
                    <Button
                        onClick={() => {
                            onOpenChange(false);
                            router.push(`/add?groupId=${group.id}`);
                        }}
                        className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold gap-1.5"
                    >
                        <Plus className="w-4 h-4" />
                        Add expense to this group
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}

function DebtRow({ from, to, amount, tone }: { from: string; to: string; amount: string; tone: 'positive' | 'negative' | 'neutral' }) {
    return (
        <li
            className={cn(
                'flex items-center justify-between gap-3 px-3 py-2 rounded-xl border',
                tone === 'negative' && 'bg-rose-400/[0.04] border-rose-400/15',
                tone === 'positive' && 'bg-emerald-400/[0.04] border-emerald-400/15',
                tone === 'neutral' && 'bg-white/[0.025] border-white/[0.06]',
            )}
        >
            <p className="text-xs flex items-center gap-1.5 min-w-0">
                <span className={cn('font-semibold truncate', tone === 'neutral' && 'text-muted-foreground')}>{from}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                <span className={cn('font-semibold truncate', tone === 'neutral' && 'text-muted-foreground')}>{to}</span>
            </p>
            <span
                className={cn(
                    'text-body font-bold tabular-nums shrink-0',
                    tone === 'negative' && 'text-rose-300',
                    tone === 'positive' && 'text-emerald-300',
                    tone === 'neutral' && 'text-muted-foreground',
                )}
            >
                {amount}
            </span>
        </li>
    );
}
