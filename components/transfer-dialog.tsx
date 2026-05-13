'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ArrowRight, ArrowRightLeft, Wallet, Landmark, PiggyBank, CreditCard as CardIcon, Smartphone, CircleDollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { useAccounts } from '@/components/providers/accounts-provider';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { ACCOUNT_TYPE_LABELS, type AccountType } from '@/types/account';

const TYPE_ICONS: Record<AccountType, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
    cash: Wallet,
    checking: Landmark,
    savings: PiggyBank,
    credit_card: CardIcon,
    digital_wallet: Smartphone,
    other: CircleDollarSign,
};

interface TransferDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function TransferDialog({ open, onOpenChange }: TransferDialogProps) {
    const { accounts } = useAccounts();
    const { convertAmount } = useUserPreferences();
    const active = useMemo(() => accounts.filter(a => !a.archived_at), [accounts]);

    const [fromId, setFromId] = useState<string>('');
    const [toId, setToId] = useState<string>('');
    const [amount, setAmount] = useState<string>('');
    const [toAmount, setToAmount] = useState<string>('');
    const [date, setDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
    const [description, setDescription] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);
    // Touched flag so the auto-conversion suggestion doesn't keep overwriting
    // a value the user has manually edited on the destination side.
    const toAmountTouchedRef = useRef(false);

    // Pick sensible defaults when the dialog opens — primary as source,
    // first other account as destination.
    useEffect(() => {
        if (!open || active.length === 0) return;
        const primary = active.find(a => a.is_primary) ?? active[0];
        setFromId(primary.id);
        const dest = active.find(a => a.id !== primary.id);
        setToId(dest?.id ?? '');
        setAmount('');
        setToAmount('');
        toAmountTouchedRef.current = false;
        setDescription('');
        setDate(format(new Date(), 'yyyy-MM-dd'));
    }, [open, active]);

    const fromAccount = active.find(a => a.id === fromId);
    const toAccount = active.find(a => a.id === toId);
    const sameAccount = fromId === toId && fromId !== '';
    const crossCurrency = !!fromAccount && !!toAccount && fromAccount.currency !== toAccount.currency;
    const parsedAmount = parseFloat(amount);
    const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
    const parsedToAmount = parseFloat(toAmount);
    const toAmountValid = Number.isFinite(parsedToAmount) && parsedToAmount > 0;

    // Auto-suggest the destination amount using the app's exchange-rate cache
    // when currencies differ. Won't override a user-touched value.
    useEffect(() => {
        if (!crossCurrency || !fromAccount || !toAccount) return;
        if (toAmountTouchedRef.current) return;
        if (!amountValid) {
            setToAmount('');
            return;
        }
        try {
            const converted = convertAmount(parsedAmount, fromAccount.currency, toAccount.currency);
            if (Number.isFinite(converted) && converted > 0) {
                // Two decimals for currency display; user can edit.
                setToAmount(converted.toFixed(2));
            }
        } catch {
            /* rate not available — leave blank */
        }
    }, [crossCurrency, amountValid, parsedAmount, fromAccount, toAccount, convertAmount]);

    const disabled =
        submitting
        || !fromAccount
        || !toAccount
        || sameAccount
        || !amountValid
        || !date
        || (crossCurrency && !toAmountValid);

    const handleSubmit = async () => {
        if (disabled || !fromAccount) return;
        setSubmitting(true);
        try {
            const { data, error } = await supabase.rpc('record_transfer', {
                p_user_id: (await supabase.auth.getUser()).data.user?.id,
                p_from_account_id: fromId,
                p_to_account_id: toId,
                p_amount: parsedAmount,
                p_date: date,
                p_description: description.trim() || null,
                p_to_amount: crossCurrency ? parsedToAmount : null,
            });
            if (error) throw error;
            const result = data as { success: boolean; error?: string } | null;
            if (!result?.success) {
                throw new Error(result?.error ?? 'Transfer failed');
            }
            invalidateTransactionCaches();
            window.dispatchEvent(new Event('novira:expense-added'));
            toast.success(`Transferred ${fromAccount.currency} ${parsedAmount}`);
            onOpenChange(false);
        } catch (e) {
            console.error('[TransferDialog] failed', e);
            toast.error(`Transfer failed: ${(e as Error).message}`);
        } finally {
            setSubmitting(false);
        }
    };

    if (active.length < 2) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Transfer between accounts</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground py-4">
                        You need at least two accounts to record a transfer. Add another in Settings → Accounts.
                    </p>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!submitting) onOpenChange(o); }}>
            <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-5 py-4 border-b border-white/5">
                    <DialogTitle className="text-base flex items-center gap-2">
                        <ArrowRightLeft className="w-4 h-4" />
                        Transfer between accounts
                    </DialogTitle>
                </DialogHeader>

                <div className="px-5 py-4 space-y-4">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                        <AccountSelect
                            label="From"
                            value={fromId}
                            onChange={setFromId}
                            accounts={active}
                            excludeId={toId}
                        />
                        <div className="pb-2 text-muted-foreground">
                            <ArrowRight className="w-4 h-4" />
                        </div>
                        <AccountSelect
                            label="To"
                            value={toId}
                            onChange={setToId}
                            accounts={active}
                            excludeId={fromId}
                        />
                    </div>

                    {sameAccount && (
                        <p className="text-[11px] text-amber-300/80">Source and destination must be different.</p>
                    )}

                    <div className={crossCurrency ? 'grid grid-cols-2 gap-3' : ''}>
                        <div>
                            <Label htmlFor="transfer-amount" className="text-xs">
                                {crossCurrency ? 'You send' : 'Amount'}{fromAccount && ` (${fromAccount.currency})`}
                            </Label>
                            <Input
                                id="transfer-amount"
                                type="text"
                                inputMode="decimal"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="h-10 text-base tabular-nums"
                                autoFocus
                            />
                        </div>
                        {crossCurrency && (
                            <div>
                                <Label htmlFor="transfer-to-amount" className="text-xs">
                                    They receive{toAccount && ` (${toAccount.currency})`}
                                </Label>
                                <Input
                                    id="transfer-to-amount"
                                    type="text"
                                    inputMode="decimal"
                                    value={toAmount}
                                    onChange={(e) => {
                                        toAmountTouchedRef.current = true;
                                        setToAmount(e.target.value);
                                    }}
                                    placeholder="0.00"
                                    className="h-10 text-base tabular-nums"
                                />
                            </div>
                        )}
                    </div>
                    {crossCurrency && amountValid && toAmountValid && (
                        <p className="text-[10.5px] text-muted-foreground/70">
                            Rate: 1 {fromAccount?.currency} ≈ {(parsedToAmount / parsedAmount).toFixed(4)} {toAccount?.currency} · adjust if your bank uses a different rate
                        </p>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label htmlFor="transfer-date" className="text-xs">Date</Label>
                            <Input
                                id="transfer-date"
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="h-10"
                            />
                        </div>
                        <div>
                            <Label htmlFor="transfer-description" className="text-xs">Note (optional)</Label>
                            <Input
                                id="transfer-description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="e.g. Bill pay"
                                maxLength={120}
                                className="h-10"
                            />
                        </div>
                    </div>

                    <p className="text-[10.5px] text-muted-foreground/60 leading-relaxed pt-1">
                        Transfers don&apos;t count as spending. Both legs are tagged so they stay out of budgets, allowance, and analytics.
                    </p>
                </div>

                <DialogFooter className="px-5 py-3 border-t border-white/5 bg-secondary/5">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={disabled}>
                        {submitting ? 'Transferring…' : 'Transfer'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface AccountSelectProps {
    label: string;
    value: string;
    onChange: (id: string) => void;
    accounts: ReturnType<typeof useAccounts>['accounts'];
    excludeId?: string;
}

function AccountSelect({ label, value, onChange, accounts, excludeId }: AccountSelectProps) {
    const current = accounts.find(a => a.id === value);
    const Icon = current ? (TYPE_ICONS[current.type] || CircleDollarSign) : Wallet;
    return (
        <div>
            <Label className="text-xs text-muted-foreground">{label}</Label>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger className="h-12 rounded-xl bg-secondary/10 border-white/10">
                    {current ? (
                        <div className="flex items-center gap-2 min-w-0">
                            <span
                                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                                style={{ backgroundColor: `${current.color}22`, border: `1px solid ${current.color}50` }}
                            >
                                <Icon className="w-3 h-3" style={{ color: current.color }} />
                            </span>
                            <div className="min-w-0 text-left">
                                <p className="text-[12.5px] font-semibold truncate leading-tight">{current.name}</p>
                                <p className="text-[9.5px] text-muted-foreground/70 leading-tight">
                                    {ACCOUNT_TYPE_LABELS[current.type]} · {current.currency}
                                </p>
                            </div>
                        </div>
                    ) : <SelectValue placeholder="Pick…" />}
                </SelectTrigger>
                <SelectContent>
                    {accounts.filter(a => a.id !== excludeId).map(a => {
                        const TypeIcon = TYPE_ICONS[a.type] || CircleDollarSign;
                        return (
                            <SelectItem key={a.id} value={a.id}>
                                <div className="flex items-center gap-2">
                                    <TypeIcon className="w-3.5 h-3.5 shrink-0" style={{ color: a.color }} />
                                    <span>{a.name}</span>
                                    <span className="text-[10px] text-muted-foreground/60">· {a.currency}</span>
                                </div>
                            </SelectItem>
                        );
                    })}
                </SelectContent>
            </Select>
        </div>
    );
}
