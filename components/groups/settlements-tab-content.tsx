import React, { useMemo, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sparkles, ArrowRight, ArrowUpRight, ArrowDownLeft, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/utils/haptics';
import type { Split } from '@/components/providers/groups-provider';
import type { SimplifiedPayment } from '@/utils/simplify-debts';

// Supabase RPC errors are plain objects ({ code, message, ... }), not Error
// instances — and a non-JSON error body yields { message: '' }. Pull a usable
// string out of anything, and never return blank so the toast always reads.
function settleErrorMessage(error: unknown, fallback: string): string {
    const raw =
        error instanceof Error ? error.message
        : typeof error === 'string' ? error
        : error && typeof error === 'object' && 'message' in error
            ? (error as { message?: unknown }).message
            : undefined;
    return typeof raw === 'string' && raw.trim() ? raw : fallback;
}

interface SettlementsTabContentProps {
    simplifiedDebts: SimplifiedPayment[];
    pendingSplits: Split[];
    userId: string | null;
    currency: string;
    formatCurrency: (amount: number, currencyCode?: string) => string;
    convertAmount: (amount: number, fromCurrency: string, toCurrency?: string) => number;
    settleSplit: (splitId: string, creditorId?: string) => Promise<boolean | void>;
    settleSplitsBatch: (splitIds: string[], creditorId?: string) => Promise<{ settled: number; total: number }>;
}

type CounterpartyGroup = {
    key: string;
    name: string;
    direction: 'debtor' | 'creditor';
    splits: Split[];
};

export function SettlementsTabContent({
    simplifiedDebts, pendingSplits, userId, currency, formatCurrency, convertAmount,
    settleSplit, settleSplitsBatch,
}: SettlementsTabContentProps) {
    const [settlingPaymentIndex, setSettlingPaymentIndex] = useState<number | null>(null);
    const [isSettlingAll, setIsSettlingAll] = useState(false);
    const [expandedCounterparties, setExpandedCounterparties] = useState<Set<string>>(new Set());

    const counterpartyGroups = useMemo<CounterpartyGroup[]>(() => {
        const map = new Map<string, CounterpartyGroup>();
        for (const split of pendingSplits) {
            const isDebtor = split.user_id === userId;
            const direction: 'debtor' | 'creditor' = isDebtor ? 'debtor' : 'creditor';
            const otherId = isDebtor ? split.transaction?.user_id : split.user_id;
            // The provider normalizes `payer_name` to always be the *other party's*
            // name relative to the current user — debtor or creditor.
            const otherName = split.transaction?.payer_name || 'Member';
            const key = `${direction}:${otherId || 'unknown'}`;
            const existing = map.get(key);
            if (existing) {
                existing.splits.push(split);
            } else {
                map.set(key, {
                    key,
                    name: otherName,
                    direction,
                    splits: [split],
                });
            }
        }
        return Array.from(map.values()).sort((a, b) => b.splits.length - a.splits.length);
    }, [pendingSplits, userId]);

    const debtorSplits = pendingSplits.filter(s => s.user_id === userId);

    const toggleGroup = (key: string) => {
        setExpandedCounterparties(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    return (
        <div className="space-y-5">
            {simplifiedDebts.length > 0 && pendingSplits.length >= 2 && (
                <section>
                    <div className="flex items-baseline justify-between mb-2 px-1">
                        <h3 className="text-[10px] font-medium uppercase tracking-[0.18em] text-amber-400 inline-flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3" aria-hidden="true" />
                            Smart settle
                        </h3>
                        <span className="text-[10px] text-muted-foreground/70 tabular-nums">
                            {simplifiedDebts.length} of {pendingSplits.length} payments
                        </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground px-1 mb-3 leading-relaxed">
                        Fewer transfers, same outcome. We combined splits across this network.
                    </p>
                    <ul className="space-y-1.5">
                        {simplifiedDebts.map((payment, index) => {
                            const isMyPayment = payment.from === userId;
                            const isSettling = settlingPaymentIndex === index;
                            return (
                                <li
                                    key={`${payment.from}-${payment.to}-${index}`}
                                    className="relative overflow-hidden rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),_0_4px_12px_-6px_rgba(0,0,0,0.5)]"
                                >
                                    <span className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r bg-amber-400" aria-hidden="true" />
                                    <div className="p-3 pl-4 flex items-center justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[13px] font-semibold truncate flex items-center gap-1.5">
                                                <span>{payment.fromName}</span>
                                                <ArrowRight className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                                                <span>{payment.toName}</span>
                                            </p>
                                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                                {payment.splitIds.length} split{payment.splitIds.length !== 1 ? 's' : ''} combined
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                                            <span className="text-[13px] font-bold text-amber-300 tabular-nums">
                                                {formatCurrency(payment.amount)}
                                            </span>
                                            <button
                                                type="button"
                                                disabled={isSettling}
                                                onClick={async () => {
                                                    setSettlingPaymentIndex(index);
                                                    try {
                                                        const counterparty = isMyPayment ? payment.to : payment.from;
                                                        const { settled, total } = await settleSplitsBatch(payment.splitIds, counterparty);
                                                        if (settled === total) {
                                                            toast.success(isMyPayment
                                                                ? `Settled ${settled} split${settled !== 1 ? 's' : ''} with ${payment.toName}`
                                                                : `Marked ${settled} payment${settled !== 1 ? 's' : ''} as received from ${payment.fromName}`,
                                                            );
                                                        } else {
                                                            toast.error(`Settled ${settled} of ${total} — please retry`);
                                                        }
                                                    } catch (error) {
                                                        toast.error(settleErrorMessage(error, 'Failed to settle'));
                                                    } finally {
                                                        setSettlingPaymentIndex(null);
                                                    }
                                                }}
                                                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-amber-400 text-amber-950 text-[11px] font-semibold hover:bg-amber-300 transition-colors disabled:opacity-60"
                                            >
                                                {isSettling ? 'Settling…' : isMyPayment ? 'Settle' : 'Mark received'}
                                            </button>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            )}

            {pendingSplits.length > 0 ? (
                <section>
                    <div className="flex items-baseline justify-between mb-2 px-1">
                        <h3 className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
                            All open splits · {pendingSplits.length}
                        </h3>
                        {debtorSplits.length >= 2 && (
                            <button
                                type="button"
                                disabled={isSettlingAll}
                                onClick={async () => {
                                    setIsSettlingAll(true);
                                    try {
                                        const ids = debtorSplits.map(s => s.id);
                                        const { settled, total } = await settleSplitsBatch(ids);
                                        if (settled === total) {
                                            toast.success(`Settled all ${settled} debt${settled !== 1 ? 's' : ''}`);
                                        } else {
                                            toast.error(`Settled ${settled} of ${total} — please retry`);
                                        }
                                    } catch (error) {
                                        toast.error(settleErrorMessage(error, 'Failed to settle all'));
                                    } finally {
                                        setIsSettlingAll(false);
                                    }
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-60"
                            >
                                <Check className="w-3 h-3" />
                                {isSettlingAll ? 'Settling…' : `Settle ${debtorSplits.length} debts`}
                            </button>
                        )}
                    </div>

                    <ul className="space-y-1.5">
                        {counterpartyGroups.map((group) => {
                            const isOpen = expandedCounterparties.has(group.key) || group.splits.length === 1;
                            const isDebtor = group.direction === 'debtor';
                            const total = group.splits.reduce((sum, s) => {
                                const c = s.transaction?.currency || currency;
                                return sum + (c === currency ? s.amount : convertAmount(s.amount, c));
                            }, 0);
                            const single = group.splits.length === 1;

                            return (
                                <li key={group.key} className="rounded-2xl border border-white/10 bg-white/[0.035] overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.05),_0_4px_12px_-6px_rgba(0,0,0,0.45)]">
                                    <button
                                        type="button"
                                        onClick={() => !single && toggleGroup(group.key)}
                                        className={cn(
                                            'w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left',
                                            !single && 'hover:bg-white/[0.04] transition-colors',
                                        )}
                                        aria-expanded={isOpen}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Avatar className="w-9 h-9 ring-1 ring-white/[0.06] shrink-0">
                                                <AvatarFallback
                                                    className={cn(
                                                        'text-[11px] font-semibold',
                                                        isDebtor ? 'bg-rose-400/10 text-rose-300' : 'bg-emerald-400/10 text-emerald-300',
                                                    )}
                                                >
                                                    {group.name.substring(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                                <p className="text-[13px] font-semibold truncate">
                                                    {isDebtor ? `You owe ${group.name}` : `${group.name} owes you`}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    {group.splits.length} split{group.splits.length !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span
                                                className={cn(
                                                    'text-[13px] font-bold tabular-nums',
                                                    isDebtor ? 'text-rose-300' : 'text-emerald-300',
                                                )}
                                            >
                                                {isDebtor ? '−' : '+'}{formatCurrency(total)}
                                            </span>
                                            {!single && (isOpen
                                                ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/50" />
                                                : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />)}
                                        </div>
                                    </button>

                                    {isOpen && (
                                        <ul className={cn('divide-y divide-white/[0.04]', !single && 'border-t border-white/[0.04]')}>
                                            {group.splits.map((split) => {
                                                const native = split.transaction?.currency;
                                                const isCrossCurrency = native && native !== currency;
                                                return (
                                                    <li
                                                        key={split.id}
                                                        className="flex items-center justify-between gap-3 px-3 py-2 bg-white/[0.015]"
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <span
                                                                className={cn(
                                                                    'w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                                                                    isDebtor ? 'bg-rose-400/10 text-rose-400' : 'bg-emerald-400/10 text-emerald-400',
                                                                )}
                                                            >
                                                                {isDebtor
                                                                    ? <ArrowUpRight className="w-3 h-3" />
                                                                    : <ArrowDownLeft className="w-3 h-3" />}
                                                            </span>
                                                            <p className="text-[12px] font-medium truncate">
                                                                {split.transaction?.description || 'Expense'}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <div className="text-right">
                                                                <span
                                                                    className={cn(
                                                                        'text-[12px] font-bold tabular-nums whitespace-nowrap',
                                                                        isDebtor ? 'text-rose-300' : 'text-emerald-300',
                                                                    )}
                                                                >
                                                                    {isDebtor ? '−' : '+'}
                                                                    {isCrossCurrency
                                                                        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: native }).format(split.amount)
                                                                        : formatCurrency(split.amount)}
                                                                </span>
                                                                {isCrossCurrency && (
                                                                    <p className="text-[10px] text-muted-foreground/70 tabular-nums">
                                                                        ≈ {formatCurrency(convertAmount(split.amount, native!))}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            {isDebtor && (
                                                                <button
                                                                    type="button"
                                                                    onClick={async () => {
                                                                        try {
                                                                            await settleSplit(split.id, split.transaction?.user_id);
                                                                            toast.success('Split settled');
                                                                        } catch (error) {
                                                                            toast.error(settleErrorMessage(error, 'Failed to settle split'));
                                                                        }
                                                                    }}
                                                                    className="inline-flex items-center h-6 px-2 rounded-full text-[10px] font-semibold text-primary border border-primary/30 hover:bg-primary/10 transition-colors"
                                                                >
                                                                    Settle
                                                                </button>
                                                            )}
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ) : (
                <div className="text-center py-12 space-y-2">
                    <div className="w-10 h-10 mx-auto rounded-full bg-emerald-400/10 flex items-center justify-center">
                        <Check className="w-5 h-5 text-emerald-400" />
                    </div>
                    <p className="text-[13px] font-semibold">All settled up</p>
                    <p className="text-[11px] text-muted-foreground">No pending payments.</p>
                </div>
            )}
        </div>
    );
}
