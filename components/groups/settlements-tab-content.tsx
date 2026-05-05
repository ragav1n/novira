import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight, Zap, ArrowUpRight, ArrowDownLeft, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/utils/haptics';
import type { Split } from '@/components/providers/groups-provider';
import type { SimplifiedPayment } from '@/utils/simplify-debts';

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

export function SettlementsTabContent({
    simplifiedDebts, pendingSplits, userId, currency, formatCurrency, convertAmount, settleSplit, settleSplitsBatch
}: SettlementsTabContentProps) {
    const [settlingPaymentIndex, setSettlingPaymentIndex] = useState<number | null>(null);
    const [isSettlingAll, setIsSettlingAll] = useState(false);

    return (
        <div className="mt-6 space-y-4">
            {/* Smart Settle Section */}
            {simplifiedDebts.length > 0 && pendingSplits.length >= 2 && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                        <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center">
                            <Sparkles className="w-3 h-3 text-amber-500" />
                        </div>
                        <div>
                            <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest">Smart Settle</h3>
                        </div>
                        <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-500/80 ml-auto">
                            {simplifiedDebts.length} payment{simplifiedDebts.length !== 1 ? 's' : ''} instead of {pendingSplits.length}
                        </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground px-1 -mt-1">
                        Settle with fewer payments — we simplified your debts.
                    </p>
                    {simplifiedDebts.map((payment, index) => {
                        const isMyPayment = payment.from === userId;
                        const isSettling = settlingPaymentIndex === index;
                        return (
                            <div key={`${payment.from}-${payment.to}-${index}`} className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/15">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                                            <Zap className="w-5 h-5 text-amber-500" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold truncate">
                                                {payment.fromName} <ArrowRight className="w-3.5 h-3.5 inline mx-1 text-muted-foreground" /> {payment.toName}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground">
                                                {payment.splitIds.length} split{payment.splitIds.length !== 1 ? 's' : ''} combined
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5 shrink-0 ml-3">
                                        <span className="font-bold text-sm text-amber-500">
                                            {formatCurrency(payment.amount)}
                                        </span>
                                        <Button
                                            size="sm"
                                            disabled={isSettling}
                                            className="h-7 text-[11px] rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30 hover:bg-amber-500/30 gap-1"
                                            onClick={async () => {
                                                setSettlingPaymentIndex(index);
                                                try {
                                                    const counterparty = isMyPayment ? payment.to : payment.from;
                                                    const { settled, total } = await settleSplitsBatch(payment.splitIds, counterparty);
                                                    if (settled === total) {
                                                        toast.success(isMyPayment
                                                            ? `Settled ${settled} split${settled !== 1 ? 's' : ''} with ${payment.toName}!`
                                                            : `Marked ${settled} payment${settled !== 1 ? 's' : ''} as received from ${payment.fromName}!`
                                                        );
                                                    } else {
                                                        toast.error(`Settled ${settled} of ${total} — please retry`);
                                                    }
                                                } catch (error) {
                                                    toast.error(error instanceof Error ? error.message : 'Failed');
                                                } finally {
                                                    setSettlingPaymentIndex(null);
                                                }
                                            }}
                                        >
                                            <Zap className="w-3 h-3" />
                                            {isSettling ? 'Settling...' : isMyPayment ? 'Settle All' : 'Mark Received'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {pendingSplits.length >= 2 && (
                        <div className="h-px bg-white/5 my-2" />
                    )}
                </div>
            )}

            {(() => {
                const debtorSplits = pendingSplits.filter(s => s.user_id === userId);
                return debtorSplits.length >= 2 ? (
                    <div className="flex justify-end">
                        <Button
                            size="sm"
                            disabled={isSettlingAll}
                            className="h-8 text-xs rounded-full bg-primary/15 text-primary border border-primary/20 hover:bg-primary/25 gap-1.5"
                            onClick={async () => {
                                setIsSettlingAll(true);
                                try {
                                    const ids = debtorSplits.map(s => s.id);
                                    const { settled, total } = await settleSplitsBatch(ids);
                                    if (settled === total) {
                                        toast.success(`Settled all ${settled} debt${settled !== 1 ? 's' : ''}!`);
                                    } else {
                                        toast.error(`Settled ${settled} of ${total} — please retry`);
                                    }
                                } catch (error) {
                                    toast.error(error instanceof Error ? error.message : 'Failed to settle all');
                                } finally {
                                    setIsSettlingAll(false);
                                }
                            }}
                        >
                            <Check className="w-3 h-3" />
                            {isSettlingAll ? 'Settling...' : `Settle All Debts (${debtorSplits.length})`}
                        </Button>
                    </div>
                ) : null;
            })()}

            {pendingSplits.length > 0 ? (
                pendingSplits.map((split) => {
                    const isDebtor = split.user_id === userId;
                    return (
                        <div key={split.id} className="flex items-center justify-between p-3 rounded-2xl bg-card/20 border border-white/5 overflow-hidden">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center border shrink-0",
                                    isDebtor ? "bg-rose-500/10 border-rose-500/20" : "bg-emerald-500/10 border-emerald-500/20"
                                )}>
                                    {isDebtor ? <ArrowUpRight className="w-5 h-5 text-rose-500" /> : <ArrowDownLeft className="w-5 h-5 text-emerald-500" />}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold truncate">{split.transaction?.description}</p>
                                    <p className="text-[11px] text-muted-foreground italic truncate">
                                        {isDebtor ? `You owe ${split.transaction?.payer_name}` : `${split.transaction?.payer_name} owes you`}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                                <span className={cn(
                                    "font-bold text-sm whitespace-nowrap",
                                    isDebtor ? "text-rose-500" : "text-emerald-500"
                                )}>
                                    {isDebtor ? '-' : '+'}
                                    {split.transaction?.currency && split.transaction.currency !== currency
                                        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: split.transaction.currency }).format(split.amount)
                                        : formatCurrency(split.amount)
                                    }
                                </span>
                                {split.transaction?.currency && split.transaction.currency !== currency && (
                                    <span className="text-[11px] text-muted-foreground">
                                        ≈ {formatCurrency(convertAmount(split.amount, split.transaction.currency))}
                                    </span>
                                )}
                                {isDebtor && (
                                    <Button
                                        size="sm"
                                        className="h-7 text-[11px] rounded-full bg-primary/20 text-primary border border-primary/20 hover:bg-primary/30"
                                        onClick={async () => {
                                            try {
                                                await settleSplit(split.id, split.transaction?.user_id);
                                                toast.success('Split settled!');
                                            } catch (error) {
                                                toast.error(error instanceof Error ? error.message : 'Failed to settle split');
                                            }
                                        }}
                                    >
                                        Settle
                                    </Button>
                                )}
                            </div>
                        </div>
                    );
                })
            ) : (
                <div className="text-center py-12 space-y-3">
                    <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center mx-auto">
                        <Check className="w-8 h-8 text-emerald-500/30" />
                    </div>
                    <p className="text-sm text-muted-foreground">All settled up! No pending payments.</p>
                </div>
            )}
        </div>
    );
}
