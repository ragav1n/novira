'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Wand2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { toast } from '@/utils/haptics';
import { invalidateTransactionCaches } from '@/lib/sw-cache';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useAccounts } from '@/components/providers/accounts-provider';

interface BulkAssignByPaymentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onApplied?: () => void;
}

const KEEP = '__keep__';

export function BulkAssignByPaymentDialog({ open, onOpenChange, onApplied }: BulkAssignByPaymentDialogProps) {
    const { userId } = useUserPreferences();
    const { accounts } = useAccounts();
    const activeAccounts = useMemo(() => accounts.filter(a => !a.archived_at), [accounts]);

    const [loading, setLoading] = useState(false);
    const [applying, setApplying] = useState(false);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [sourceAccountId, setSourceAccountId] = useState<string>('any');

    // Map of display key (trimmed) → set of exact DB values that map to it.
    // Lets the UI group whitespace-variant rows together (" Cash " vs "Cash")
    // while the UPDATE later targets each exact value so all matching rows move.
    const [rawByKey, setRawByKey] = useState<Record<string, string[]>>({});

    const fetchCounts = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try {
            let query = supabase
                .from('transactions')
                .select('payment_method')
                .eq('user_id', userId);
            if (sourceAccountId !== 'any') {
                query = query.eq('account_id', sourceAccountId);
            }
            const { data, error } = await query;
            if (error) throw error;
            const counts: Record<string, number> = {};
            const raws: Record<string, Set<string>> = {};
            for (const row of (data ?? []) as { payment_method: string | null }[]) {
                const trimmed = row.payment_method?.trim();
                const key = trimmed && trimmed.length > 0 ? trimmed : '(none)';
                counts[key] = (counts[key] ?? 0) + 1;
                if (!raws[key]) raws[key] = new Set();
                raws[key].add(row.payment_method ?? '');
            }
            const rawMap: Record<string, string[]> = {};
            for (const [k, set] of Object.entries(raws)) {
                rawMap[k] = [...set];
            }
            setCounts(counts);
            setRawByKey(rawMap);
        } catch (e) {
            console.error('[BulkAssignByPayment] counts failed', e);
            toast.error('Failed to load payment-method breakdown');
        } finally {
            setLoading(false);
        }
    }, [userId, sourceAccountId]);

    useEffect(() => {
        if (!open) return;
        setMapping({});
        fetchCounts();
    }, [open, fetchCounts]);

    const sortedMethods = useMemo(
        () => Object.entries(counts).sort((a, b) => b[1] - a[1]),
        [counts],
    );
    const totalAffected = useMemo(() => {
        let total = 0;
        for (const [method, count] of sortedMethods) {
            const target = mapping[method];
            if (target && target !== KEEP) total += count;
        }
        return total;
    }, [mapping, sortedMethods]);

    const handleApply = async () => {
        if (!userId || totalAffected === 0) return;
        setApplying(true);
        try {
            let totalMoved = 0;
            for (const [method, count] of sortedMethods) {
                const target = mapping[method];
                if (!target || target === KEEP) continue;
                // Hit every exact DB value that mapped to this display key —
                // covers whitespace variants like " Cash " in one pass.
                const rawValues = rawByKey[method] ?? [];
                const nullValues = rawValues.filter(v => v === '');
                const stringValues = rawValues.filter(v => v !== '');
                if (nullValues.length > 0) {
                    let q = supabase
                        .from('transactions')
                        .update({ account_id: target })
                        .eq('user_id', userId)
                        .is('payment_method', null);
                    if (sourceAccountId !== 'any') q = q.eq('account_id', sourceAccountId);
                    const { error } = await q;
                    if (error) throw error;
                }
                if (stringValues.length > 0) {
                    let q = supabase
                        .from('transactions')
                        .update({ account_id: target })
                        .eq('user_id', userId)
                        .in('payment_method', stringValues);
                    if (sourceAccountId !== 'any') q = q.eq('account_id', sourceAccountId);
                    const { error } = await q;
                    if (error) throw error;
                }
                totalMoved += count;
            }
            invalidateTransactionCaches();
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('novira:expense-added'));
            }
            toast.success(`Reassigned ${totalMoved} transaction${totalMoved === 1 ? '' : 's'}`);
            onOpenChange(false);
            onApplied?.();
        } catch (e) {
            console.error('[BulkAssignByPayment] apply failed', e);
            toast.error(`Failed: ${(e as Error).message}`);
        } finally {
            setApplying(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!applying) onOpenChange(o); }}>
            <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-5 py-4 border-b border-white/5">
                    <DialogTitle className="text-base flex items-center gap-2">
                        <Wand2 className="w-4 h-4" />
                        Bulk-assign by payment method
                    </DialogTitle>
                </DialogHeader>

                <div className="px-5 py-4 space-y-4">
                    <p className="text-[11.5px] text-muted-foreground/80 leading-relaxed">
                        Map each payment method to the account that actually paid. Every
                        matching transaction moves at once. Leave a row as &ldquo;Keep&rdquo; to skip it.
                    </p>

                    <div>
                        <Label className="text-xs">Apply to transactions currently on</Label>
                        <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
                            <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="any">Any account</SelectItem>
                                {activeAccounts.map(a => (
                                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2 border-t border-white/5 pt-3">
                        {loading && (
                            <p className="text-[12px] text-muted-foreground/60 text-center py-4">Counting…</p>
                        )}
                        {!loading && sortedMethods.length === 0 && (
                            <p className="text-[12px] text-muted-foreground/60 text-center py-4">
                                No matching transactions on this account.
                            </p>
                        )}
                        {!loading && sortedMethods.map(([method, count]) => (
                            <div key={method} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                                <div className="min-w-0">
                                    <p className="text-[12.5px] font-semibold truncate">{method}</p>
                                    <p className="text-[10.5px] text-muted-foreground/60">
                                        {count} transaction{count === 1 ? '' : 's'}
                                    </p>
                                </div>
                                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40" />
                                <Select
                                    value={mapping[method] ?? KEEP}
                                    onValueChange={(v) => setMapping(prev => ({ ...prev, [method]: v }))}
                                >
                                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={KEEP}>Keep as is</SelectItem>
                                        {activeAccounts.map(a => (
                                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ))}
                    </div>

                    {totalAffected > 0 && (
                        <div className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2.5 text-[11.5px] text-primary/90">
                            <span className="font-bold">{totalAffected}</span> transaction{totalAffected === 1 ? '' : 's'} will move accounts when you tap Apply.
                        </div>
                    )}
                </div>

                <DialogFooter className="px-5 py-3 border-t border-white/5 bg-secondary/5">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={applying}>Cancel</Button>
                    <Button onClick={handleApply} disabled={applying || totalAffected === 0}>
                        {applying ? 'Applying…' : `Apply${totalAffected ? ` (${totalAffected})` : ''}`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
