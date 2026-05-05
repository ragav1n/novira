'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { ArrowRight, Plus, Home, Plane, Heart, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { simplifyDebtsForGroup, type SimplifiedPayment } from '@/utils/simplify-debts';
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

const getTypeIcon = (type?: string) => {
    switch (type) {
        case 'home': return Home;
        case 'trip': return Plane;
        case 'couple': return Heart;
        default: return FileText;
    }
};

export function GroupDetailSheet({
    group, currentUserId, pendingSplits, currency, formatCurrency, convertAmount, open, onOpenChange
}: GroupDetailSheetProps) {
    const router = useRouter();
    const [transactions, setTransactions] = useState<RecentTransaction[]>([]);
    const [totalSpent, setTotalSpent] = useState(0);
    const [loadingTx, setLoadingTx] = useState(false);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoadingTx(true);

        (async () => {
            // Fetch enough rows to find 10 non-settlement transactions even if recent
            // history is dominated by settlements. 50 is a generous cushion.
            const { data, error } = await supabase
                .from('transactions')
                .select('id, description, amount, currency, date, user_id, is_settlement, profile:profiles(full_name)')
                .eq('group_id', group.id)
                .order('date', { ascending: false })
                .limit(50);

            if (cancelled) return;
            if (error) {
                console.error('[group-detail] fetch failed', error);
                setLoadingTx(false);
                return;
            }

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

            // Total spent across the entire group, excluding settlement transactions.
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

    const Icon = getTypeIcon(group.type);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="bottom"
                className="rounded-t-3xl border-t border-white/10 bg-card/95 backdrop-blur-xl max-h-[88vh] overflow-y-auto"
            >
                <SheetHeader className="px-5 pt-5">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            'w-11 h-11 rounded-2xl flex items-center justify-center border shrink-0',
                            group.type === 'home' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                                group.type === 'trip' ? 'bg-sky-500/10 border-sky-500/20 text-sky-500' :
                                    group.type === 'couple' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' :
                                        'bg-primary/10 border-primary/20 text-primary'
                        )}>
                            <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <SheetTitle className="truncate text-base">{group.name}</SheetTitle>
                            <SheetDescription className="text-[11px]">
                                {group.members.length} member{group.members.length !== 1 ? 's' : ''} · Total spent {formatCurrency(totalSpent)}
                            </SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                <div className="px-5 py-4 space-y-5">
                    {/* Per-member balance block */}
                    <div className="space-y-2">
                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Balances in this group</h3>
                        {groupDebts.length === 0 ? (
                            <div className="rounded-2xl border border-white/5 bg-secondary/10 p-4 text-center">
                                <p className="text-xs text-muted-foreground">All settled up in this group.</p>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {myPayments.map((p, i) => (
                                    <div key={`me-pays-${i}`} className="flex items-center justify-between p-3 rounded-2xl bg-rose-500/5 border border-rose-500/15">
                                        <p className="text-xs">
                                            <span className="font-bold">You</span>
                                            <ArrowRight className="w-3 h-3 inline mx-1.5 text-muted-foreground" />
                                            <span className="font-bold">{p.toName}</span>
                                        </p>
                                        <span className="text-sm font-bold text-rose-500">{formatCurrency(p.amount)}</span>
                                    </div>
                                ))}
                                {myCredits.map((p, i) => (
                                    <div key={`me-receives-${i}`} className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/15">
                                        <p className="text-xs">
                                            <span className="font-bold">{p.fromName}</span>
                                            <ArrowRight className="w-3 h-3 inline mx-1.5 text-muted-foreground" />
                                            <span className="font-bold">You</span>
                                        </p>
                                        <span className="text-sm font-bold text-emerald-500">{formatCurrency(p.amount)}</span>
                                    </div>
                                ))}
                                {otherDebts.map((p, i) => (
                                    <div key={`others-${i}`} className="flex items-center justify-between p-3 rounded-2xl bg-secondary/10 border border-white/5">
                                        <p className="text-xs">
                                            <span className="font-bold text-muted-foreground">{p.fromName}</span>
                                            <ArrowRight className="w-3 h-3 inline mx-1.5 text-muted-foreground" />
                                            <span className="font-bold text-muted-foreground">{p.toName}</span>
                                        </p>
                                        <span className="text-sm font-bold text-muted-foreground">{formatCurrency(p.amount)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Members list */}
                    <div className="space-y-2">
                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Members</h3>
                        <div className="flex flex-wrap gap-2">
                            {group.members.map((m) => (
                                <Badge
                                    key={m.user_id}
                                    variant="secondary"
                                    className="rounded-full pl-1 pr-2.5 py-0.5 text-[11px] gap-1.5"
                                >
                                    <Avatar className="w-4 h-4">
                                        <AvatarImage src={m.avatar_url || ''} />
                                        <AvatarFallback className="text-[7px]">{m.full_name?.substring(0, 1) || '?'}</AvatarFallback>
                                    </Avatar>
                                    {m.user_id === currentUserId ? 'You' : (m.full_name || 'Member')}
                                </Badge>
                            ))}
                        </div>
                    </div>

                    {/* Recent activity */}
                    <div className="space-y-2">
                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Recent activity</h3>
                        {loadingTx ? (
                            <div className="space-y-2">
                                {[0, 1, 2].map(i => (
                                    <div key={i} className="h-12 rounded-2xl bg-secondary/20 animate-pulse" />
                                ))}
                            </div>
                        ) : transactions.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-white/10 bg-secondary/5 p-5 text-center">
                                <p className="text-xs text-muted-foreground">No expenses yet in this group.</p>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {transactions.map((tx) => (
                                    <div key={tx.id} className="flex items-center justify-between p-3 rounded-2xl bg-secondary/10 border border-white/5">
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold truncate">{tx.description || 'Expense'}</p>
                                            <p className="text-[10px] text-muted-foreground">
                                                {tx.payer_name} · {format(parseISO(tx.date.slice(0, 10)), 'MMM d')}
                                            </p>
                                        </div>
                                        <span className="text-xs font-bold whitespace-nowrap ml-2">
                                            {formatCurrency(tx.amount, tx.currency)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="sticky bottom-0 left-0 right-0 px-5 py-4 bg-card/95 border-t border-white/5 backdrop-blur-xl">
                    <Button
                        onClick={() => {
                            onOpenChange(false);
                            router.push(`/add?groupId=${group.id}`);
                        }}
                        className="w-full h-11 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Add expense to this group
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
