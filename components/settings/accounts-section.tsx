'use client';

import React, { useState } from 'react';
import {
    Plus, Pencil, Archive, ArchiveRestore, Trash2, Star, StarOff,
    Wallet, Landmark, PiggyBank, CreditCard, Smartphone, CircleDollarSign,
} from 'lucide-react';
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
    const {
        accounts, loading, createAccount, updateAccount, archiveAccount,
        deleteAccount, setPrimary,
    } = useAccounts();
    const [editing, setEditing] = useState<DraftAccount | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<Account | null>(null);
    const [saving, setSaving] = useState(false);

    const active = accounts.filter(a => !a.archived_at);
    const archived = accounts.filter(a => !!a.archived_at);

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
                                    <p className="text-[10.5px] text-muted-foreground/60">
                                        {ACCOUNT_TYPE_LABELS[a.type]} · Opening {formatCurrency(a.opening_balance, a.currency)}
                                        {a.credit_limit !== null && ` · Limit ${formatCurrency(a.credit_limit, a.currency)}`}
                                    </p>
                                </div>
                            </button>
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
