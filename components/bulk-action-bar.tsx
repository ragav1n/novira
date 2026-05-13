'use client';

import React, { useState } from 'react';
import { Trash2, FolderInput, Tag as TagIcon, Check, Wallet, Landmark, PiggyBank, CreditCard as CardIcon, Smartphone, CircleDollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { CATEGORIES as SYSTEM_CATEGORIES, CATEGORY_COLORS, getIconForCategory } from '@/lib/categories';
import type { Bucket } from '@/components/providers/buckets-provider';
import type { Account, AccountType } from '@/types/account';
import { ACCOUNT_TYPE_LABELS } from '@/types/account';

const ACCOUNT_TYPE_ICONS_BULK: Record<AccountType, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
    cash: Wallet,
    checking: Landmark,
    savings: PiggyBank,
    credit_card: CardIcon,
    digital_wallet: Smartphone,
    other: CircleDollarSign,
};

interface BulkActionBarProps {
    count: number;
    onCancel: () => void;
    onDelete: () => Promise<void> | void;
    onRecategorize: (categoryId: string) => Promise<void> | void;
    onMoveToBucket: (bucketId: string | null) => Promise<void> | void;
    onMoveToAccount?: (accountId: string) => Promise<void> | void;
    buckets: Bucket[];
    accounts?: Account[];
    /**
     * Current bucket id shared by all selected transactions, or null if they
     * are all unbucketed. `undefined` means a mixed set — no highlight.
     */
    currentBucketId?: string | null | undefined;
    /** Same idea for category — undefined means "mixed selection". */
    currentCategory?: string | undefined;
    /** Same idea for account. */
    currentAccountId?: string | null | undefined;
}

export function BulkActionBar({
    count, onCancel, onDelete, onRecategorize, onMoveToBucket, onMoveToAccount, buckets, accounts,
    currentBucketId, currentCategory, currentAccountId,
}: BulkActionBarProps) {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
    const [bucketPickerOpen, setBucketPickerOpen] = useState(false);
    const [accountPickerOpen, setAccountPickerOpen] = useState(false);

    const activeBuckets = buckets.filter(b => !b.is_archived);
    const activeAccounts = (accounts ?? []).filter(a => !a.archived_at);
    const accountActionAvailable = !!onMoveToAccount && activeAccounts.length > 0;

    return (
        <>
            <div
                role="toolbar"
                aria-label={`${count} selected`}
                className="fixed bottom-0 left-0 right-0 z-[120] pointer-events-none px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
            >
                <div className="max-w-md lg:max-w-2xl mx-auto pointer-events-auto rounded-2xl bg-card/95 backdrop-blur-xl border border-white/10 shadow-2xl flex items-center gap-1 p-1.5">
                    <div className="px-2.5 text-[12px] font-semibold tabular-nums">
                        <span className="text-primary">{count}</span>
                        <span className="text-muted-foreground/70"> selected</span>
                    </div>
                    <div className="w-px h-6 bg-white/10" />
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCategoryPickerOpen(true)}
                        disabled={count === 0}
                        className="flex-1 h-9 gap-1.5 text-[12px]"
                    >
                        <TagIcon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Recategorize</span>
                        <span className="sm:hidden">Cat</span>
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setBucketPickerOpen(true)}
                        disabled={count === 0}
                        className="flex-1 h-9 gap-1.5 text-[12px]"
                    >
                        <FolderInput className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Bucket</span>
                        <span className="sm:hidden">Bkt</span>
                    </Button>
                    {accountActionAvailable && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setAccountPickerOpen(true)}
                            disabled={count === 0}
                            className="flex-1 h-9 gap-1.5 text-[12px]"
                        >
                            <Wallet className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Account</span>
                            <span className="sm:hidden">Acct</span>
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDelete(true)}
                        disabled={count === 0}
                        className="flex-1 h-9 gap-1.5 text-[12px] text-rose-300 hover:text-rose-200 hover:bg-rose-500/10"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                    </Button>
                    <div className="w-px h-6 bg-white/10" />
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onCancel}
                        className="h-9 text-[12px] text-muted-foreground"
                    >
                        Cancel
                    </Button>
                </div>
            </div>

            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <AlertDialogContent className="z-[130]">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {count} transaction{count === 1 ? '' : 's'}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This can&apos;t be undone. Any attached receipts will also be removed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={async () => {
                                setConfirmDelete(false);
                                await onDelete();
                            }}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={categoryPickerOpen} onOpenChange={setCategoryPickerOpen}>
                <DialogContent className="max-w-md z-[130]">
                    <DialogHeader>
                        <DialogTitle>Set category for {count}</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-2 pt-2">
                        {SYSTEM_CATEGORIES.map(cat => {
                            const color = CATEGORY_COLORS[cat.id] || '#8A2BE2';
                            const isCurrent = currentCategory === cat.id;
                            return (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={async () => {
                                        if (isCurrent) { setCategoryPickerOpen(false); return; }
                                        setCategoryPickerOpen(false);
                                        await onRecategorize(cat.id);
                                    }}
                                    aria-current={isCurrent ? 'true' : undefined}
                                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                                        isCurrent
                                            ? 'border-primary/40 bg-primary/10'
                                            : 'border-white/5 bg-secondary/10 hover:border-white/20 hover:bg-secondary/15'
                                    }`}
                                >
                                    <span
                                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: `${color}18`, border: `1px solid ${color}30` }}
                                    >
                                        {React.cloneElement(
                                            getIconForCategory(cat.id, 'w-3.5 h-3.5') as React.ReactElement<{ style?: React.CSSProperties }>,
                                            { style: { color } },
                                        )}
                                    </span>
                                    <span className="text-[12px] font-semibold truncate flex-1">{cat.label}</span>
                                    {isCurrent && <Check className="w-3.5 h-3.5 text-primary shrink-0" strokeWidth={3} />}
                                </button>
                            );
                        })}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={accountPickerOpen} onOpenChange={setAccountPickerOpen}>
                <DialogContent className="max-w-md z-[130]">
                    <DialogHeader>
                        <DialogTitle>Move {count} to account</DialogTitle>
                    </DialogHeader>
                    {currentAccountId === undefined && count > 0 && (
                        <p className="px-1 pt-1 text-[11px] text-amber-300/80">
                            Mixed selection — these transactions are currently on different accounts.
                        </p>
                    )}
                    <div className="space-y-1.5 pt-2 max-h-[60vh] overflow-y-auto">
                        {activeAccounts.length === 0 && (
                            <p className="px-3 py-6 text-center text-[12px] text-muted-foreground/60">
                                No accounts yet. Add one in settings.
                            </p>
                        )}
                        {activeAccounts.map(a => {
                            const isCurrent = currentAccountId === a.id;
                            const TypeIcon = ACCOUNT_TYPE_ICONS_BULK[a.type] || CircleDollarSign;
                            return (
                                <button
                                    key={a.id}
                                    type="button"
                                    onClick={async () => {
                                        if (isCurrent) { setAccountPickerOpen(false); return; }
                                        setAccountPickerOpen(false);
                                        if (onMoveToAccount) await onMoveToAccount(a.id);
                                    }}
                                    aria-current={isCurrent ? 'true' : undefined}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                                        isCurrent
                                            ? 'border-primary/40 bg-primary/10'
                                            : 'border-white/5 bg-secondary/10 hover:border-white/20 hover:bg-secondary/15'
                                    }`}
                                >
                                    <span
                                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: `${a.color}22`, border: `1px solid ${a.color}50` }}
                                    >
                                        <TypeIcon className="w-3.5 h-3.5" style={{ color: a.color }} />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[12px] font-semibold truncate">{a.name}</p>
                                        <p className="text-[10px] text-muted-foreground/60">{ACCOUNT_TYPE_LABELS[a.type]} · {a.currency}</p>
                                    </div>
                                    {isCurrent && <Check className="w-3.5 h-3.5 text-primary shrink-0" strokeWidth={3} />}
                                </button>
                            );
                        })}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={bucketPickerOpen} onOpenChange={setBucketPickerOpen}>
                <DialogContent className="max-w-md z-[130]">
                    <DialogHeader>
                        <DialogTitle>Move {count} to bucket</DialogTitle>
                    </DialogHeader>
                    {currentBucketId === undefined && count > 0 && (
                        <p className="px-1 pt-1 text-[11px] text-amber-300/80">
                            Mixed selection — these transactions are currently in different buckets.
                        </p>
                    )}
                    <div className="space-y-1.5 pt-2 max-h-[60vh] overflow-y-auto">
                        {(() => {
                            const isNoneCurrent = currentBucketId === null;
                            return (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (isNoneCurrent) { setBucketPickerOpen(false); return; }
                                        setBucketPickerOpen(false);
                                        await onMoveToBucket(null);
                                    }}
                                    aria-current={isNoneCurrent ? 'true' : undefined}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                                        isNoneCurrent
                                            ? 'border-primary/40 bg-primary/10'
                                            : 'border-white/5 bg-secondary/10 hover:border-white/20 hover:bg-secondary/15'
                                    }`}
                                >
                                    <span className="w-7 h-7 rounded-full bg-secondary/30 flex items-center justify-center shrink-0">
                                        <FolderInput className="w-3.5 h-3.5 text-muted-foreground" />
                                    </span>
                                    <span className="text-[12px] font-semibold flex-1">No bucket</span>
                                    {isNoneCurrent
                                        ? <Check className="w-3.5 h-3.5 text-primary shrink-0" strokeWidth={3} />
                                        : <span className="text-[10px] text-muted-foreground/60">Clear</span>}
                                </button>
                            );
                        })()}
                        {activeBuckets.length === 0 && (
                            <p className="px-3 py-6 text-center text-[12px] text-muted-foreground/60">
                                No buckets yet. Create one in the dashboard.
                            </p>
                        )}
                        {activeBuckets.map(b => {
                            const isCurrent = currentBucketId === b.id;
                            return (
                                <button
                                    key={b.id}
                                    type="button"
                                    onClick={async () => {
                                        if (isCurrent) { setBucketPickerOpen(false); return; }
                                        setBucketPickerOpen(false);
                                        await onMoveToBucket(b.id);
                                    }}
                                    aria-current={isCurrent ? 'true' : undefined}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                                        isCurrent
                                            ? 'border-primary/40 bg-primary/10'
                                            : 'border-white/5 bg-secondary/10 hover:border-white/20 hover:bg-secondary/15'
                                    }`}
                                >
                                    <span
                                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: `${b.color || '#8A2BE2'}20`, border: `1px solid ${b.color || '#8A2BE2'}40` }}
                                    >
                                        <span className="text-[10px] font-bold" style={{ color: b.color || '#8A2BE2' }}>
                                            {b.name.charAt(0).toUpperCase()}
                                        </span>
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[12px] font-semibold truncate">{b.name}</p>
                                        {b.type && <p className="text-[10px] text-muted-foreground/60 capitalize">{b.type}</p>}
                                    </div>
                                    {isCurrent && <Check className="w-3.5 h-3.5 text-primary shrink-0" strokeWidth={3} />}
                                </button>
                            );
                        })}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
