'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
    Plus, Pencil, Archive, ArchiveRestore, Trash2, Star, StarOff, Scale, Wand2, MoreVertical,
    Wallet, Landmark, PiggyBank, CreditCard, Smartphone, CircleDollarSign,
} from 'lucide-react';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BulkAssignByPaymentDialog } from './bulk-assign-by-payment-dialog';
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
    /**
     * Extra openings keyed by currency (excludes the default-currency row,
     * which lives in opening_balance). For forex / multi-currency wallets.
     */
    opening_extras: Record<string, string>;
    credit_limit: string;
    color: string;
    is_primary: boolean;
};

const emptyDraft = (defaultCurrency: string): DraftAccount => ({
    name: '',
    type: 'cash',
    currency: defaultCurrency,
    opening_balance: '0',
    opening_extras: {},
    credit_limit: '',
    color: TYPE_DEFAULT_COLORS.cash,
    is_primary: false,
});

interface Props {
    defaultCurrency: string;
    formatCurrency: (amount: number, currency?: string) => string;
}

export function AccountsSection({ defaultCurrency, formatCurrency }: Props) {
    const { userId, currency: baseCurrency, convertAmount } = useUserPreferences();
    const {
        accounts, loading, createAccount, updateAccount, archiveAccount,
        deleteAccount, setPrimary,
    } = useAccounts();
    const [editing, setEditing] = useState<DraftAccount | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<Account | null>(null);
    const [saving, setSaving] = useState(false);
    // Activity (signed Σ converted_amount) in the user's base currency, per account.
    // Opening balance is added client-side after a currency conversion.
    const [activity, setActivity] = useState<Record<string, number>>({});
    // Total spent (gross outflow) per account in base currency.
    const [spent, setSpent] = useState<Record<string, number>>({});
    // Per-currency native activity per account, so forex / multi-currency
    // wallets can show their actual holdings instead of one collapsed total.
    const [perCurrency, setPerCurrency] = useState<Record<string, Record<string, number>>>({});
    const [reconciling, setReconciling] = useState<Account | null>(null);
    const [bulkAssignOpen, setBulkAssignOpen] = useState(false);

    const active = accounts.filter(a => !a.archived_at);
    const archived = accounts.filter(a => !!a.archived_at);

    const fetchBalances = useCallback(async () => {
        if (!userId) return;
        const { data, error } = await supabase.rpc('compute_account_balances', { p_user_id: userId });
        if (error) {
            console.error('[AccountsSection] balances failed', error);
            return;
        }
        // SQL returns per-currency activity rows. Keep the native per-currency
        // breakdown (for multi-currency display) AND build a converted total
        // in current base (for single-currency display + utilization math).
        // converted_amount is intentionally bypassed so historical base-currency
        // changes don't poison the math.
        const totals: Record<string, number> = {};
        const spentTotals: Record<string, number> = {};
        const native: Record<string, Record<string, number>> = {};
        for (const row of (data ?? []) as { account_id: string; tx_currency: string; activity_native: number; spent_native: number }[]) {
            const amount = Number(row.activity_native);
            const spentNative = Number(row.spent_native ?? 0);
            const currency = row.tx_currency || baseCurrency;
            const inBase = convertAmount(amount, currency, baseCurrency);
            const spentInBase = convertAmount(spentNative, currency, baseCurrency);
            totals[row.account_id] = (totals[row.account_id] ?? 0) + inBase;
            spentTotals[row.account_id] = (spentTotals[row.account_id] ?? 0) + spentInBase;
            if (!native[row.account_id]) native[row.account_id] = {};
            native[row.account_id][currency] = (native[row.account_id][currency] ?? 0) + amount;
        }
        setActivity(totals);
        setSpent(spentTotals);
        setPerCurrency(native);
    }, [userId, baseCurrency, convertAmount]);

    useEffect(() => { fetchBalances(); }, [fetchBalances, accounts]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const onChange = () => fetchBalances();
        window.addEventListener('novira:expense-added', onChange);
        return () => window.removeEventListener('novira:expense-added', onChange);
    }, [fetchBalances]);

    const openNew = () => setEditing(emptyDraft(defaultCurrency));
    const openEdit = (a: Account) => {
        // For credit cards, the canonical sign is negative-for-debt so the
        // balance math (opening + activity) works the same as every other
        // account type. The form labels it "Starting debt" and the user enters
        // a positive number — flip the sign across the boundary so neither
        // side has to think about it.
        const isCard = a.type === 'credit_card';
        const flipSign = (v: number) => isCard ? -v : v;
        const extras: Record<string, string> = {};
        const map = a.opening_balances ?? {};
        for (const [curr, amt] of Object.entries(map)) {
            if (curr !== a.currency) extras[curr] = String(flipSign(amt));
        }
        setEditing({
            id: a.id,
            name: a.name,
            type: a.type,
            currency: a.currency,
            opening_balance: String(flipSign(a.opening_balance)),
            opening_extras: extras,
            credit_limit: a.credit_limit !== null ? String(a.credit_limit) : '',
            color: a.color || TYPE_DEFAULT_COLORS[a.type],
            is_primary: a.is_primary,
        });
    };

    const handleSave = async () => {
        if (!editing) return;
        if (!editing.name.trim()) {
            toast.error('Name is required');
            return;
        }
        const openingInput = parseFloat(editing.opening_balance || '0');
        if (Number.isNaN(openingInput)) {
            toast.error('Opening balance must be a number');
            return;
        }
        // Credit cards: form takes "Starting debt" as a positive number; we
        // store as negative so the balance formula (opening + activity)
        // matches every other account type without per-type casing.
        const isCardForm = editing.type === 'credit_card';
        const flipSign = (v: number) => isCardForm ? -v : v;
        const opening = flipSign(openingInput);
        // Build the per-currency opening map (default + extras).
        const openingMap: Record<string, number> = {};
        if (opening !== 0) openingMap[editing.currency] = opening;
        for (const [curr, str] of Object.entries(editing.opening_extras)) {
            if (!str.trim()) continue;
            const parsed = parseFloat(str);
            if (Number.isNaN(parsed)) {
                toast.error(`${curr} opening balance must be a number`);
                return;
            }
            if (parsed !== 0) openingMap[curr] = flipSign(parsed);
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
                    opening_balances: openingMap,
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
                    opening_balances: openingMap,
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
                    const isCard = a.type === 'credit_card';
                    const isWallet = a.type === 'digital_wallet';
                    // For "simple" account types we surface gross spending only —
                    // opening_balance and the balance frame are overhead the user
                    // didn't ask for. Credit cards and digital wallets keep their
                    // balance framing because that's the actual point there.
                    const usesBalanceFraming = isCard || isWallet;

                    // Per-currency breakdown for forex / multi-currency wallets.
                    const accountNative = perCurrency[a.id] ?? {};
                    const openings: Record<string, number> = (a.opening_balances && Object.keys(a.opening_balances).length > 0)
                        ? a.opening_balances
                        : (Math.abs(a.opening_balance) >= 0.005 ? { [a.currency]: a.opening_balance } : {});
                    const allCurrencies = new Set<string>([...Object.keys(openings), ...Object.keys(accountNative)]);
                    const breakdown: { currency: string; amount: number }[] = [];
                    for (const curr of allCurrencies) {
                        const total = (openings[curr] ?? 0) + (accountNative[curr] ?? 0);
                        if (Math.abs(total) >= 0.005) breakdown.push({ currency: curr, amount: total });
                    }
                    const isMultiCurrency = usesBalanceFraming && breakdown.length > 1;

                    // Balance (signed) in base currency. Used by credit-card +
                    // wallet flows for "Owed / Available" and utilization.
                    const activityVal = activity[a.id];
                    const openingInBase = Object.entries(openings)
                        .reduce((acc, [curr, val]) => acc + convertAmount(val, curr, baseCurrency), 0);
                    const computedBalance = activityVal === undefined ? undefined : openingInBase + activityVal;

                    // Primary label per type:
                    //   credit_card: "₹X owed" / "₹Y available"
                    //   digital_wallet (single currency): balance in that currency
                    //   digital_wallet (multi-currency): rendered separately below
                    //   everything else: "₹X spent"
                    let primaryLabel: string | null = null;
                    if (isCard && computedBalance !== undefined) {
                        primaryLabel = computedBalance >= 0
                            ? `${formatCurrency(computedBalance)} available`
                            : `${formatCurrency(-computedBalance)} owed`;
                    } else if (isWallet && breakdown.length === 1) {
                        const only = breakdown[0];
                        primaryLabel = formatCurrency(only.amount, only.currency);
                    } else if (isWallet && breakdown.length === 0) {
                        // No activity / no opening yet — surface zero in account currency.
                        primaryLabel = `${formatCurrency(0, a.currency)} balance`;
                    } else if (!isWallet && spent[a.id] !== undefined) {
                        primaryLabel = `${formatCurrency(spent[a.id])} spent`;
                    }

                    // Credit limit utilization (credit cards only).
                    const limitInBase = (a.credit_limit ?? null) !== null
                        ? convertAmount(a.credit_limit as number, a.currency, baseCurrency)
                        : null;
                    const utilizationPct = (isCard && limitInBase && limitInBase > 0 && computedBalance !== undefined && computedBalance < 0)
                        ? Math.min(100, Math.round((-computedBalance / limitInBase) * 100))
                        : null;
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
                                        {!isMultiCurrency && primaryLabel && <> · <span className="text-foreground/80 font-semibold">{primaryLabel}</span></>}
                                        {utilizationPct !== null && !isMultiCurrency && (
                                            <> · <span className={utilizationPct >= 80 ? 'text-rose-400 font-semibold' : 'text-amber-300 font-semibold'}>{utilizationPct}% used</span></>
                                        )}
                                    </p>
                                    {isMultiCurrency && (
                                        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                                            {breakdown.map(b => (
                                                <span key={b.currency} className="text-[11px] tabular-nums">
                                                    <span className="text-foreground/85 font-semibold">{formatCurrency(b.amount, b.currency)}</span>
                                                </span>
                                            ))}
                                            {computedBalance !== undefined && Math.abs(computedBalance) >= 0.005 && (
                                                <span className="text-[10px] text-muted-foreground/60">
                                                    ≈ {formatCurrency(computedBalance)} {baseCurrency}
                                                </span>
                                            )}
                                        </div>
                                    )}
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
                                </div>
                            </button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                        aria-label="Account actions"
                                    >
                                        <MoreVertical className="w-4 h-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openEdit(a)} className="gap-2">
                                        <Pencil className="w-3.5 h-3.5" />
                                        Edit
                                    </DropdownMenuItem>
                                    {!a.is_primary && (
                                        <DropdownMenuItem
                                            onClick={() => setPrimary(a.id).catch(() => toast.error('Failed to set primary'))}
                                            className="gap-2"
                                        >
                                            <StarOff className="w-3.5 h-3.5" />
                                            Set as primary
                                        </DropdownMenuItem>
                                    )}
                                    {usesBalanceFraming && (
                                        <DropdownMenuItem onClick={() => setReconciling(a)} className="gap-2">
                                            <Scale className="w-3.5 h-3.5" />
                                            Reconcile
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem
                                        onClick={() => archiveAccount(a.id, true).catch(() => toast.error('Failed to archive'))}
                                        className="gap-2"
                                    >
                                        <Archive className="w-3.5 h-3.5" />
                                        Archive
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
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

            <div className="grid grid-cols-2 gap-2">
                <Button onClick={openNew} variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add account
                </Button>
                <Button
                    onClick={() => setBulkAssignOpen(true)}
                    variant="outline"
                    size="sm"
                    disabled={active.length < 2}
                    title={active.length < 2 ? 'Add another account first' : 'Reassign historical tx by payment method'}
                >
                    <Wand2 className="w-4 h-4 mr-2" />
                    Bulk reassign
                </Button>
            </div>

            <BulkAssignByPaymentDialog
                open={bulkAssignOpen}
                onOpenChange={setBulkAssignOpen}
                onApplied={() => { /* realtime + dispatch refresh the section */ }}
            />

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

                            {/* Opening balance + credit limit. Only surface for account
                                types that actually use balance framing on the row
                                (credit cards, digital wallets). Cash / checking / savings /
                                other just track spending, so opening_balance has no
                                user-visible effect — and exposing it via a disclosure
                                would be a half-functional dead end. */}
                            {(() => {
                                const showOpeningPrimary = editing.type === 'credit_card' || editing.type === 'digital_wallet';
                                if (!showOpeningPrimary) return null;
                                const isCardForm = editing.type === 'credit_card';
                                const openingLabel = isCardForm ? `Starting debt (${editing.currency})` : `Opening (${editing.currency})`;
                                const openingFields = (
                                    <>
                                        <div className={editing.type === 'credit_card' ? 'grid grid-cols-2 gap-3' : ''}>
                                            <div>
                                                <Label htmlFor="account-opening" className="text-xs">{openingLabel}</Label>
                                                <Input
                                                    id="account-opening"
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={editing.opening_balance}
                                                    onChange={(e) => setEditing({ ...editing, opening_balance: e.target.value })}
                                                    placeholder="0.00"
                                                    className="h-9 tabular-nums"
                                                />
                                                {isCardForm && (
                                                    <p className="text-[10px] text-muted-foreground/60 mt-1">Owed at sign-up (enter as positive).</p>
                                                )}
                                            </div>
                                            {isCardForm && (
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
                                        {Object.keys(editing.opening_extras).length > 0 && (
                                            <div className="space-y-2 rounded-xl border border-white/5 bg-secondary/5 p-3 mt-3">
                                                <p className="text-[10.5px] uppercase tracking-wider text-muted-foreground/70 font-bold">Other-currency openings</p>
                                                {Object.entries(editing.opening_extras).map(([curr, amt]) => (
                                                    <div key={curr} className="grid grid-cols-[80px_1fr_auto] gap-2 items-center">
                                                        <div className="text-[12px] font-semibold tabular-nums px-2 py-1 rounded bg-secondary/30 text-center">{curr}</div>
                                                        <Input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={amt}
                                                            onChange={(e) => setEditing({
                                                                ...editing,
                                                                opening_extras: { ...editing.opening_extras, [curr]: e.target.value },
                                                            })}
                                                            placeholder="0.00"
                                                            className="h-8 tabular-nums"
                                                        />
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                            onClick={() => {
                                                                const next = { ...editing.opening_extras };
                                                                delete next[curr];
                                                                setEditing({ ...editing, opening_extras: next });
                                                            }}
                                                            aria-label={`Remove ${curr} opening`}
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <details className="text-[11px] mt-2">
                                            <summary className="cursor-pointer text-muted-foreground/70 hover:text-muted-foreground">
                                                + Add another currency opening
                                            </summary>
                                            <div className="flex gap-2 mt-2">
                                                <div className="flex-1">
                                                    <CurrencyDropdown
                                                        value={editing.currency}
                                                        onValueChange={(c) => {
                                                            if (c === editing.currency) return;
                                                            if (editing.opening_extras[c] !== undefined) return;
                                                            setEditing({
                                                                ...editing,
                                                                opening_extras: { ...editing.opening_extras, [c]: '0' },
                                                            });
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground/60 mt-1">Pick a currency to add a row above.</p>
                                        </details>
                                    </>
                                );

                                return <div>{openingFields}</div>;
                            })()}

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
                breakdown={reconciling ? (() => {
                    const accountNative = perCurrency[reconciling.id] ?? {};
                    const map = new Map<string, number>();
                    for (const [curr, amt] of Object.entries(accountNative)) {
                        const total = (curr === reconciling.currency ? reconciling.opening_balance : 0) + amt;
                        if (Math.abs(total) >= 0.005) map.set(curr, total);
                    }
                    if (!map.has(reconciling.currency) && Math.abs(reconciling.opening_balance) >= 0.005) {
                        map.set(reconciling.currency, reconciling.opening_balance);
                    }
                    if (map.size === 0) map.set(reconciling.currency, 0);
                    return [...map.entries()].map(([currency, amount]) => ({ currency, amount }));
                })() : []}
                baseCurrency={baseCurrency}
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
    /** Per-currency native balances on the account. Always at least one entry. */
    breakdown: { currency: string; amount: number }[];
    baseCurrency: string;
    formatCurrency: (amount: number, currency?: string) => string;
    onOpenChange: (open: boolean) => void;
}

function ReconcileDialog({ account, breakdown, formatCurrency, onOpenChange }: ReconcileDialogProps) {
    const [actuals, setActuals] = useState<Record<string, string>>({});

    useEffect(() => {
        if (account) setActuals({});
    }, [account]);

    if (!account) return null;

    const isCard = account.type === 'credit_card';

    const formatComputed = (amount: number, currency: string) => {
        if (isCard) {
            return amount >= 0
                ? `${formatCurrency(amount, currency)} available`
                : `${formatCurrency(-amount, currency)} owed`;
        }
        return formatCurrency(amount, currency);
    };

    return (
        <Dialog open={!!account} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-5 py-4 border-b border-white/5">
                    <DialogTitle className="text-base">Reconcile {account.name}</DialogTitle>
                </DialogHeader>
                <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
                    {breakdown.length > 1 && (
                        <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                            This account holds balances in multiple currencies. Enter what your bank or
                            wallet actually shows for each — Novira will report any mismatch per currency.
                        </p>
                    )}
                    {breakdown.map(b => {
                        const actualStr = actuals[b.currency] ?? '';
                        const parsed = parseFloat(actualStr);
                        const actualValid = Number.isFinite(parsed);
                        const normalizedActual = isCard && actualValid ? -parsed : parsed;
                        const delta = actualValid ? normalizedActual - b.amount : null;
                        const inAgreement = delta !== null && Math.abs(delta) < 0.005;
                        return (
                            <div key={b.currency} className="space-y-2 rounded-xl border border-white/5 bg-secondary/5 p-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground/60 font-bold">{b.currency}</span>
                                    <span className="text-[14px] font-semibold tabular-nums">{formatComputed(b.amount, b.currency)}</span>
                                </div>
                                <div>
                                    <Label htmlFor={`reconcile-${b.currency}`} className="text-[10.5px] text-muted-foreground/80">
                                        Your actual{isCard ? ' (amount owed)' : ''}
                                    </Label>
                                    <Input
                                        id={`reconcile-${b.currency}`}
                                        type="text"
                                        inputMode="decimal"
                                        value={actualStr}
                                        onChange={(e) => setActuals(prev => ({ ...prev, [b.currency]: e.target.value }))}
                                        placeholder="0.00"
                                        className="h-9 tabular-nums"
                                    />
                                </div>
                                {actualValid && (
                                    <div className={`text-[11.5px] rounded-lg px-2 py-1.5 ${
                                        inAgreement
                                            ? 'bg-emerald-500/10 text-emerald-300'
                                            : 'bg-amber-500/10 text-amber-300'
                                    }`}>
                                        {inAgreement ? (
                                            <span className="font-semibold">In agreement.</span>
                                        ) : (
                                            <>
                                                <span className="font-semibold">Off by {formatCurrency(Math.abs(delta as number), b.currency)}</span>
                                                <span className="opacity-80 ml-1">
                                                    — {(delta as number) > 0
                                                        ? 'unrecorded deposit / transfer in'
                                                        : 'unrecorded expense / fee / transfer out'}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    <p className="text-[10.5px] text-muted-foreground/60 leading-relaxed">
                        Read-only check. To fix a mismatch, add the missing transaction(s) and Novira will recompute.
                    </p>
                </div>
                <DialogFooter className="px-5 py-3 border-t border-white/5 bg-secondary/5">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
