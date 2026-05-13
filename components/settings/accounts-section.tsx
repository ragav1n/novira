'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
    Plus, Pencil, Archive, ArchiveRestore, Trash2, Star, StarOff, Scale,
    Wallet, Landmark, PiggyBank, CreditCard, Smartphone, CircleDollarSign,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CurrencyDropdown } from '@/components/ui/currency-dropdown';
import { toast } from '@/utils/haptics';
import { useAccounts } from '@/components/providers/accounts-provider';
import { type Account, type AccountType, ACCOUNT_TYPE_LABELS } from '@/types/account';

const TYPE_ICONS: Record<AccountType, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
    cash: Wallet,
    checking: Landmark,
    savings: PiggyBank,
    credit_card: CreditCard,
    digital_wallet: Smartphone,
    other: CircleDollarSign,
};

const TYPE_DEFAULT_COLORS: Record<AccountType, string> = {
    cash: '#22C55E',
    checking: '#3B82F6',
    savings: '#A855F7',
    credit_card: '#F97316',
    digital_wallet: '#06B6D4',
    other: '#94A3B8',
};

const COLOR_SWATCHES = [
    '#22C55E', '#3B82F6', '#A855F7', '#F97316', '#06B6D4',
    '#F59E0B', '#EF4444', '#10B981', '#8B5CF6', '#EC4899',
];

type DraftAccount = {
    id?: string;
    name: string;
    type: AccountType;
    currency: string;
    opening_balance: string;
    credit_limit: string;
    color: string;
    is_primary: boolean;
};

const emptyDraft = (defaultCurrency: string): DraftAccount => ({
    name: '',
    type: 'cash',
    currency: defaultCurrency,
    opening_balance: '0',
    credit_limit: '',
    color: TYPE_DEFAULT_COLORS.cash,
    is_primary: false,
});

interface Props {
    defaultCurrency: string;
    formatCurrency: (amount: number, currency?: string) => string;
}

export function AccountsSection({ defaultCurrency, formatCurrency }: Props) {
    const { userId } = useUserPreferences();
    const {
        accounts, loading, createAccount, updateAccount, archiveAccount,
        deleteAccount, setPrimary,
    } = useAccounts();
    const [editing, setEditing] = useState<DraftAccount | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<Account | null>(null);
    const [saving, setSaving] = useState(false);
    const [balances, setBalances] = useState<Record<string, number>>({});
    const [reconciling, setReconciling] = useState<Account | null>(null);

    const active = accounts.filter(a => !a.archived_at);
    const archived = accounts.filter(a => !!a.archived_at);

    const fetchBalances = useCallback(async () => {
        if (!userId) return;
        const { data, error } = await supabase.rpc('compute_account_balances', { p_user_id: userId });
        if (error) {
            console.error('[AccountsSection] balances failed', error);
            return;
        }
        const map: Record<string, number> = {};
        for (const row of (data ?? []) as { account_id: string; balance: number }[]) {
            map[row.account_id] = Number(row.balance);
        }
        setBalances(map);
    }, [userId]);

    useEffect(() => { fetchBalances(); }, [fetchBalances, accounts]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const onChange = () => fetchBalances();
        window.addEventListener('novira:expense-added', onChange);
        return () => window.removeEventListener('novira:expense-added', onChange);
    }, [fetchBalances]);

    const openNew = () => setEditing(emptyDraft(defaultCurrency));
    const openEdit = (a: Account) => setEditing({
        id: a.id,
        name: a.name,
        type: a.type,
        currency: a.currency,
        opening_balance: String(a.opening_balance),
        credit_limit: a.credit_limit !== null ? String(a.credit_limit) : '',
        color: a.color || TYPE_DEFAULT_COLORS[a.type],
        is_primary: a.is_primary,
    });

    const handleSave = async () => {
        if (!editing) return;
        if (!editing.name.trim()) {
            toast.error('Name is required');
            return;
        }
        const opening = parseFloat(editing.opening_balance || '0');
        if (Number.isNaN(opening)) {
            toast.error('Opening balance must be a number');
            return;
        }
        let creditLimit: number | null = null;
        if (editing.type === 'credit_card' && editing.credit_limit.trim()) {
            const parsed = parseFloat(editing.credit_limit);
            if (Number.isNaN(parsed) || parsed < 0) {
                toast.error('Credit limit must be a non-negative number');
                return;
            }
            creditLimit = parsed;
        }
        setSaving(true);
        try {
            if (editing.id) {
                await updateAccount(editing.id, {
                    name: editing.name.trim(),
                    type: editing.type,
                    currency: editing.currency,
                    opening_balance: opening,
                    credit_limit: creditLimit,
                    color: editing.color,
                });
                if (editing.is_primary) await setPrimary(editing.id);
                toast.success('Account updated');
            } else {
                const created = await createAccount({
                    name: editing.name.trim(),
                    type: editing.type,
                    currency: editing.currency,
                    opening_balance: opening,
                    credit_limit: creditLimit,
                    color: editing.color,
                    is_primary: editing.is_primary,
                });
                if (created && editing.is_primary) await setPrimary(created.id);
                toast.success('Account added');
            }
            setEditing(null);
        } catch (e) {
            console.error('[AccountsSection] save failed', e);
            toast.error(`Failed to save: ${(e as Error).message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (a: Account) => {
        try {
            await deleteAccount(a.id);
            toast.success('Account deleted');
        } catch (e) {
            toast.error(`Failed to delete: ${(e as Error).message}`);
        }
        setConfirmDelete(null);
    };

    return (
        <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                Track separate wallets — checking, savings, credit cards. New transactions
                land on your primary account by default. Archived accounts stay visible in
                history but disappear from pickers.
            </p>

            <div className="bg-secondary/5 rounded-xl border border-white/5 divide-y divide-white/5 min-h-[48px]">
                {loading && (
                    <div className="p-4 text-center text-xs text-muted-foreground/60">Loading…</div>
                )}
                {!loading && active.length === 0 && (
                    <div className="p-4 text-center text-xs text-muted-foreground/60">
                        No active accounts. Add one to get started.
                    </div>
                )}
                {!loading && active.map(a => {
                    const Icon = TYPE_ICONS[a.type] || CircleDollarSign;
                    const computed = balances[a.id];
                    const isCard = a.type === 'credit_card';
                    // For credit cards, "balance" goes negative as you charge.
                    // Surface the amount owed as a positive number plus utilization
                    // against the credit limit.
                    const balanceLabel = computed === undefined
                        ? null
                        : isCard
                            ? (computed >= 0
                                ? `${formatCurrency(computed, a.currency)} available`
                                : `${formatCurrency(-computed, a.currency)} owed`)
                            : formatCurrency(computed, a.currency);
                    const utilizationPct = (isCard && a.credit_limit && a.credit_limit > 0 && computed !== undefined && computed < 0)
                        ? Math.min(100, Math.round((-computed / a.credit_limit) * 100))
                        : null;
                    // Non-credit accounts shouldn't have a negative computed balance;
                    // when they do, it's almost always backfill noise or an
                    // unset opening balance. Surface a one-line nudge.
                    const showOpeningHint = !isCard && computed !== undefined && computed < 0 && a.opening_balance === 0;
                    return (
                        <div key={a.id} className="flex items-center justify-between gap-2 p-3">
                            <button
                                type="button"
                                onClick={() => openEdit(a)}
                                className="flex-1 min-w-0 flex items-center gap-3 text-left"
                            >
                                <span
                                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                                    style={{ backgroundColor: `${a.color}20`, border: `1px solid ${a.color}40` }}
                                >
                                    <Icon className="w-4 h-4" style={{ color: a.color }} />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-[13px] font-semibold truncate">{a.name}</p>
                                        {a.is_primary && <Star className="w-3 h-3 text-amber-400 shrink-0" fill="currentColor" />}
                                    </div>
                                    <p className="text-[10.5px] text-muted-foreground/60 truncate">
                                        {ACCOUNT_TYPE_LABELS[a.type]}
                                        {balanceLabel && <> · <span className="text-foreground/80 font-semibold">{balanceLabel}</span></>}
                                        {utilizationPct !== null && (
                                            <> · <span className={utilizationPct >= 80 ? 'text-rose-400 font-semibold' : 'text-amber-300 font-semibold'}>{utilizationPct}% used</span></>
                                        )}
                                    </p>
                                    {utilizationPct !== null && a.credit_limit !== null && (
                                        <div className="mt-1.5 h-1 rounded-full bg-white/5 overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all"
                                                style={{
                                                    width: `${utilizationPct}%`,
                                                    backgroundColor: utilizationPct >= 80 ? '#F43F5E' : utilizationPct >= 50 ? '#F59E0B' : a.color,
                                                }}
                                            />
                                        </div>
                                    )}
                                    {showOpeningHint && (
                                        <p className="text-[10px] text-amber-300/80 mt-1 leading-snug">
                                            Negative — set the opening balance, or reassign these to other accounts.
                                        </p>
                                    )}
                                </div>
                            </button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                onClick={() => setReconciling(a)}
                                aria-label="Reconcile account"
                                title="Reconcile"
                            >
                                <Scale className="w-4 h-4" />
                            </Button>
                            {!a.is_primary && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-amber-400"
                                    onClick={() => setPrimary(a.id).catch(() => toast.error('Failed to set primary'))}
                                    aria-label="Set as primary"
                                    title="Set as primary"
                                >
                                    <StarOff className="w-4 h-4" />
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                onClick={() => openEdit(a)}
                                aria-label="Edit account"
                            >
                                <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-muted-foreground/90"
                                onClick={() => archiveAccount(a.id, true).catch(() => toast.error('Failed to archive'))}
                                aria-label="Archive account"
                                title="Archive"
                            >
                                <Archive className="w-4 h-4" />
                            </Button>
                        </div>
                    );
                })}
            </div>

            {archived.length > 0 && (
                <details className="bg-secondary/5 rounded-xl border border-white/5">
                    <summary className="cursor-pointer px-3 py-2 text-[11px] font-semibold text-muted-foreground/70 hover:text-muted-foreground">
                        Archived ({archived.length})
                    </summary>
                    <div className="divide-y divide-white/5 border-t border-white/5">
                        {archived.map(a => {
                            const Icon = TYPE_ICONS[a.type] || CircleDollarSign;
                            return (
                                <div key={a.id} className="flex items-center justify-between gap-2 p-3 opacity-70">
                                    <div className="flex-1 min-w-0 flex items-center gap-3">
                                        <span
                                            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 grayscale"
                                            style={{ backgroundColor: `${a.color}20` }}
                                        >
                                            <Icon className="w-4 h-4 text-muted-foreground" />
                                        </span>
                                        <p className="text-[12.5px] font-medium truncate">{a.name}</p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                                        onClick={() => archiveAccount(a.id, false).catch(() => toast.error('Failed to unarchive'))}
                                        aria-label="Unarchive account"
                                    >
                                        <ArchiveRestore className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        onClick={() => setConfirmDelete(a)}
                                        aria-label="Delete account"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                </details>
            )}

            <Button onClick={openNew} variant="outline" size="sm" className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add account
            </Button>

            <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
                <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
                    <DialogHeader className="px-5 py-4 border-b border-white/5">
                        <DialogTitle className="text-base">{editing?.id ? 'Edit account' : 'New account'}</DialogTitle>
                    </DialogHeader>
                    {editing && (
                        <div className="px-5 py-4 space-y-4">
                            <div>
                                <Label htmlFor="account-name" className="text-xs">Name</Label>
                                <Input
                                    id="account-name"
                                    value={editing.name}
                                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                                    placeholder="Chase Checking"
                                    maxLength={50}
                                    autoFocus
                                    className="h-9"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs">Type</Label>
                                    <Select
                                        value={editing.type}
                                        onValueChange={(v) => {
                                            const t = v as AccountType;
                                            setEditing({
                                                ...editing,
                                                type: t,
                                                color: editing.color || TYPE_DEFAULT_COLORS[t],
                                                credit_limit: t === 'credit_card' ? editing.credit_limit : '',
                                            });
                                        }}
                                    >
                                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map(t => (
                                                <SelectItem key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-xs">Currency</Label>
                                    <CurrencyDropdown
                                        value={editing.currency}
                                        onValueChange={(c) => setEditing({ ...editing, currency: c })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label htmlFor="account-opening" className="text-xs">Opening balance</Label>
                                    <Input
                                        id="account-opening"
                                        type="text"
                                        inputMode="decimal"
                                        value={editing.opening_balance}
                                        onChange={(e) => setEditing({ ...editing, opening_balance: e.target.value })}
                                        placeholder="0.00"
                                        className="h-9 tabular-nums"
                                    />
                                </div>
                                {editing.type === 'credit_card' && (
                                    <div>
                                        <Label htmlFor="account-limit" className="text-xs">Credit limit</Label>
                                        <Input
                                            id="account-limit"
                                            type="text"
                                            inputMode="decimal"
                                            value={editing.credit_limit}
                                            onChange={(e) => setEditing({ ...editing, credit_limit: e.target.value })}
                                            placeholder="Optional"
                                            className="h-9 tabular-nums"
                                        />
                                    </div>
                                )}
                            </div>

                            <div>
                                <Label className="text-xs">Color</Label>
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {COLOR_SWATCHES.map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setEditing({ ...editing, color: c })}
                                            aria-label={`Color ${c}`}
                                            className={`w-6 h-6 rounded-full transition-transform ${editing.color === c ? 'ring-2 ring-offset-2 ring-offset-card scale-110' : 'hover:scale-105'}`}
                                            style={{ backgroundColor: c, boxShadow: editing.color === c ? `0 0 0 2px ${c}` : undefined }}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                <div>
                                    <Label className="text-xs">Primary account</Label>
                                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">Used as default when adding expenses</p>
                                </div>
                                <Switch
                                    checked={editing.is_primary}
                                    onCheckedChange={(next) => setEditing({ ...editing, is_primary: next })}
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter className="px-5 py-3 border-t border-white/5 bg-secondary/5">
                        <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saving || !editing?.name.trim()}>
                            {saving ? 'Saving…' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ReconcileDialog
                account={reconciling}
                computedBalance={reconciling ? balances[reconciling.id] : undefined}
                formatCurrency={formatCurrency}
                onOpenChange={(o) => { if (!o) setReconciling(null); }}
            />

            <AlertDialog open={!!confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {confirmDelete?.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Transactions previously assigned to this account will be set to no account, but won&apos;t be deleted.
                            This can&apos;t be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => confirmDelete && handleDelete(confirmDelete)}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

interface ReconcileDialogProps {
    account: Account | null;
    computedBalance: number | undefined;
    formatCurrency: (amount: number, currency?: string) => string;
    onOpenChange: (open: boolean) => void;
}

function ReconcileDialog({ account, computedBalance, formatCurrency, onOpenChange }: ReconcileDialogProps) {
    const [actualStr, setActualStr] = useState('');

    useEffect(() => {
        if (account) setActualStr('');
    }, [account]);

    if (!account) return null;

    const isCard = account.type === 'credit_card';
    const computedDisplay = computedBalance === undefined
        ? '—'
        : isCard
            ? (computedBalance >= 0
                ? `${formatCurrency(computedBalance, account.currency)} available`
                : `${formatCurrency(-computedBalance, account.currency)} owed`)
            : formatCurrency(computedBalance, account.currency);

    const actual = parseFloat(actualStr);
    const actualValid = Number.isFinite(actual);
    // For credit cards, the user enters the amount they OWE (a positive number),
    // which corresponds to a negative computed balance.
    const normalizedActual = isCard && actualValid ? -actual : actual;
    const delta = (actualValid && computedBalance !== undefined)
        ? normalizedActual - computedBalance
        : null;
    const inAgreement = delta !== null && Math.abs(delta) < 0.005;

    return (
        <Dialog open={!!account} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-5 py-4 border-b border-white/5">
                    <DialogTitle className="text-base">Reconcile {account.name}</DialogTitle>
                </DialogHeader>
                <div className="px-5 py-4 space-y-4">
                    <div className="rounded-xl border border-white/5 bg-secondary/10 px-3 py-2.5">
                        <p className="text-[10.5px] uppercase tracking-wider text-muted-foreground/60">Novira computes</p>
                        <p className="text-[15px] font-semibold tabular-nums mt-0.5">{computedDisplay}</p>
                    </div>
                    <div>
                        <Label htmlFor="reconcile-actual" className="text-xs">
                            Your actual balance{isCard ? ' (amount owed)' : ''}
                        </Label>
                        <Input
                            id="reconcile-actual"
                            type="text"
                            inputMode="decimal"
                            value={actualStr}
                            onChange={(e) => setActualStr(e.target.value)}
                            placeholder="0.00"
                            className="h-10 text-base tabular-nums"
                            autoFocus
                        />
                    </div>
                    {actualValid && computedBalance !== undefined && (
                        <div className={`rounded-xl border px-3 py-3 ${
                            inAgreement
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                        }`}>
                            {inAgreement ? (
                                <p className="text-[13px] font-semibold">In agreement — Novira matches your bank.</p>
                            ) : (
                                <>
                                    <p className="text-[13px] font-semibold">
                                        Off by {formatCurrency(Math.abs(delta as number), account.currency)}
                                    </p>
                                    <p className="text-[10.5px] mt-1 opacity-80">
                                        {(delta as number) > 0
                                            ? 'Bank shows more than Novira — you likely have an unrecorded deposit or transfer in.'
                                            : 'Bank shows less than Novira — you likely have an unrecorded expense, fee, or transfer out.'}
                                    </p>
                                </>
                            )}
                        </div>
                    )}
                    <p className="text-[10.5px] text-muted-foreground/60 leading-relaxed">
                        This is a read-only check. To fix a mismatch, add the missing transaction(s) — Novira will recompute.
                    </p>
                </div>
                <DialogFooter className="px-5 py-3 border-t border-white/5 bg-secondary/5">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
