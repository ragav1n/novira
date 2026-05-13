'use client';

import React, { Suspense } from 'react';
import { Transaction, AuditLog } from '@/types/transaction';
import { Bucket } from '@/components/providers/buckets-provider';
import { TransactionHistoryDialog } from '@/components/transaction-history-dialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Wallet, Landmark, PiggyBank, CreditCard as CardIcon, Smartphone, CircleDollarSign, X } from 'lucide-react';
import { useAccounts } from '@/components/providers/accounts-provider';
import type { AccountType } from '@/types/account';

const ACCOUNT_TYPE_ICONS_EDIT: Record<AccountType, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
    cash: Wallet,
    checking: Landmark,
    savings: PiggyBank,
    credit_card: CardIcon,
    digital_wallet: Smartphone,
    other: CircleDollarSign,
};
import { cn } from '@/lib/utils';
import { CHART_CONFIG } from '@/lib/categories';
import dynamic from 'next/dynamic';
import { WelcomeModal } from '@/components/welcome-modal';
import { FeatureAnnouncementModal } from '@/components/feature-announcement-modal';
import { LATEST_FEATURE_ANNOUNCEMENT } from '@/lib/feature-flags';
import { UIBoundary } from '@/components/boundaries/ui-boundary';

const LocationPicker = dynamic(
    () => import('@/components/ui/location-picker').then(mod => mod.LocationPicker),
    { ssr: false }
);
const ExpenseMapView = dynamic(
    () => import('@/components/expense-map-view').then(mod => mod.ExpenseMapView),
    { ssr: false, loading: () => <div className="fixed inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-[150]"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div> }
);
const AddFundsDialog = dynamic(
    () => import('@/components/add-funds-dialog').then(module => ({ default: module.AddFundsDialog })),
    { ssr: false, loading: () => <div className="fixed inset-0 min-h-[300px] flex items-center justify-center bg-background/50 backdrop-blur-sm z-[150]"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div> }
);
const HowToUseDialog = dynamic(
    () => import('@/components/how-to-use-dialog').then(module => ({ default: module.HowToUseDialog })),
    { ssr: false }
);

interface DashboardDialogsProps {
    userId: string | null;
    currency: string;
    // Budget Dialog
    isBudgetEditOpen: boolean;
    setIsBudgetEditOpen: (open: boolean) => void;
    activeWorkspaceId: string | null;
    tempBudgetInput: string;
    setTempBudgetInput: (val: string) => void;
    handleSaveBudget: () => void;
    // Audit Dialog
    selectedAuditTx: Transaction | null;
    setSelectedAuditTx: (tx: Transaction | null) => void;
    auditLogs: AuditLog[];
    loadingAudit: boolean;
    // Edit Dialog
    isEditOpen: boolean;
    setIsEditOpen: (open: boolean) => void;
    editingTransaction: Transaction | null;
    setEditingTransaction: (tx: Transaction | null) => void;
    handleUpdateTransaction: (e: React.FormEvent) => void;
    activeBuckets: Bucket[];
    getBucketIcon: (iconName?: string) => React.ReactNode;
    // Map View
    isMapOpen: boolean;
    setIsMapOpen: (open: boolean) => void;
    transactions: Transaction[];
    formatCurrency: (amount: number, currency?: string) => string;
    convertAmount: (amount: number, fromCurrency: string, toCurrency: string) => number;
    // Other Modals
    activeModal: 'welcome' | 'announcement' | null;
    setActiveModal: (modal: 'welcome' | 'announcement' | null) => void;
    isAddFundsOpen: boolean;
    setIsAddFundsOpen: (open: boolean) => void;
    isHowToUseOpen: boolean;
    setIsHowToUseOpen: (open: boolean) => void;
    dashboardFocus: string;
    isBucketFocused: boolean;
    loadTransactions: (userId: string) => void;
}

export function DashboardDialogs({
    userId,
    currency,
    isBudgetEditOpen,
    setIsBudgetEditOpen,
    activeWorkspaceId,
    tempBudgetInput,
    setTempBudgetInput,
    handleSaveBudget,
    selectedAuditTx,
    setSelectedAuditTx,
    auditLogs,
    loadingAudit,
    isEditOpen,
    setIsEditOpen,
    editingTransaction,
    setEditingTransaction,
    handleUpdateTransaction,
    activeBuckets,
    getBucketIcon,
    isMapOpen,
    setIsMapOpen,
    transactions,
    formatCurrency,
    convertAmount,
    activeModal,
    setActiveModal,
    isAddFundsOpen,
    setIsAddFundsOpen,
    isHowToUseOpen,
    setIsHowToUseOpen,
    dashboardFocus,
    isBucketFocused,
    loadTransactions
}: DashboardDialogsProps) {
    const { accounts: allAccounts } = useAccounts();
    const editableAccounts = React.useMemo(
        () => allAccounts.filter(a => !a.archived_at),
        [allAccounts],
    );
    return (
        <>
            {/* Budget Edit Dialog */}
            <Dialog open={isBudgetEditOpen} onOpenChange={setIsBudgetEditOpen}>
                <DialogContent className="max-w-[340px] bg-card border-white/10 rounded-3xl p-6">
                    <DialogHeader className="mb-4">
                        <DialogTitle>Edit {activeWorkspaceId ? 'Workspace' : 'Personal'} Budget</DialogTitle>
                        <DialogDescription className="text-xs">
                            Set your monthly spending allowance for this context.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="monthly-budget">Monthly Allowance ({currency})</Label>
                            <Input
                                id="monthly-budget"
                                name="monthly-budget"
                                type="number"
                                value={tempBudgetInput}
                                onChange={(e) => setTempBudgetInput(e.target.value)}
                                placeholder="e.g. 5000"
                                autoComplete="off"
                                className="bg-secondary/50 border-white/10 h-12 rounded-xl text-lg font-bold"
                            />
                        </div>
                        <Button onClick={handleSaveBudget} className="w-full h-12 rounded-xl font-bold bg-primary hover:bg-primary/90">
                            Save Budget
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <TransactionHistoryDialog
                isOpen={!!selectedAuditTx}
                onOpenChange={(open) => !open && setSelectedAuditTx(null)}
                transaction={selectedAuditTx}
                auditLogs={auditLogs}
                isLoading={loadingAudit}
            />

            {/* Edit Transaction Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="max-w-md rounded-3xl border-white/10 bg-card/95 backdrop-blur-xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
                    <DialogHeader>
                        <DialogTitle>Edit Transaction</DialogTitle>
                        <DialogDescription>Update your transaction details.</DialogDescription>
                    </DialogHeader>
                    {editingTransaction && (
                        <form onSubmit={handleUpdateTransaction} className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-description">Description</Label>
                                <Input
                                    id="edit-description"
                                    value={editingTransaction.description}
                                    onChange={(e) => setEditingTransaction({ ...editingTransaction, description: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-amount">Amount</Label>
                                <Input
                                    id="edit-amount"
                                    type="number"
                                    step="0.01"
                                    value={editingTransaction.amount}
                                    onChange={(e) => setEditingTransaction({ ...editingTransaction, amount: parseFloat(e.target.value) })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-category">Category</Label>
                                <Select
                                    value={editingTransaction.category}
                                    onValueChange={(val) => setEditingTransaction({ ...editingTransaction, category: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card/95 backdrop-blur-xl border-white/10">
                                        {Object.keys(CHART_CONFIG).map((cat) => (
                                            <SelectItem key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {/* Bucket Selection in Edit Mode */}
                            <div className="space-y-2">
                                <Label>Personal Bucket (Private)</Label>
                                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                    <div
                                        onClick={() => setEditingTransaction({ ...editingTransaction, bucket_id: undefined })}
                                        className={cn(
                                            "flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all min-w-[70px] cursor-pointer",
                                            !editingTransaction.bucket_id
                                                ? "bg-secondary/30 border-white/20"
                                                : "bg-background/20 border-white/5 hover:border-white/10"
                                        )}
                                    >
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-secondary/20 border border-white/5">
                                            <X className="w-3.5 h-3.5 text-muted-foreground" />
                                        </div>
                                        <span className="text-[9px] font-medium truncate w-14 text-center">None</span>
                                    </div>
                                    {activeBuckets.map((bucket) => (
                                        <div
                                            key={bucket.id}
                                            onClick={() => setEditingTransaction({ ...editingTransaction, bucket_id: bucket.id })}
                                            className={cn(
                                                "flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all min-w-[70px] cursor-pointer",
                                                editingTransaction.bucket_id === bucket.id
                                                    ? "bg-primary/20 border-primary shadow-[0_0_15px_rgba(138,43,226,0.2)]"
                                                    : "bg-background/20 border-white/5 hover:border-white/10"
                                            )}
                                        >
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-secondary/20 border border-white/5">
                                                <div className="w-4 h-4 text-primary">
                                                    {getBucketIcon(bucket.icon)}
                                                </div>
                                            </div>
                                            <span className="text-[9px] font-medium truncate w-14 text-center">{bucket.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* Account Selection in Edit Mode */}
                            {editableAccounts.length > 0 && (
                                <div className="space-y-2">
                                    <Label>Account</Label>
                                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                        {editableAccounts.map((a) => {
                                            const TypeIcon = ACCOUNT_TYPE_ICONS_EDIT[a.type] || CircleDollarSign;
                                            const selected = editingTransaction.account_id === a.id;
                                            return (
                                                <div
                                                    key={a.id}
                                                    onClick={() => setEditingTransaction({ ...editingTransaction, account_id: a.id })}
                                                    className={cn(
                                                        'flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all min-w-[70px] cursor-pointer',
                                                        !selected && 'bg-background/20 border-white/5 hover:border-white/10',
                                                    )}
                                                    style={selected ? {
                                                        backgroundColor: `${a.color}1F`,
                                                        borderColor: `${a.color}80`,
                                                        boxShadow: `0 0 15px ${a.color}26`,
                                                    } : undefined}
                                                >
                                                    <div
                                                        className="w-8 h-8 rounded-full flex items-center justify-center"
                                                        style={{ backgroundColor: `${a.color}22`, border: `1px solid ${a.color}50` }}
                                                    >
                                                        <TypeIcon className="w-3.5 h-3.5" style={{ color: a.color }} />
                                                    </div>
                                                    <span className="text-[9px] font-medium truncate w-14 text-center">{a.name}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {/* Exclude from Allowance Toggle */}
                            <div className="space-y-4 pt-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Wallet className="w-4 h-4 text-cyan-500" />
                                        <div>
                                            <p className="text-sm font-medium">Exclude from Allowance</p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={!!editingTransaction.exclude_from_allowance}
                                        onCheckedChange={(val: boolean) => setEditingTransaction({ ...editingTransaction, exclude_from_allowance: val })}
                                        className="data-[state=checked]:bg-cyan-500"
                                    />
                                </div>
                            </div>
                            {/* Location in Edit Mode */}
                            <LocationPicker
                                placeName={editingTransaction.place_name || null}
                                placeAddress={editingTransaction.place_address || null}
                                placeLat={editingTransaction.place_lat || null}
                                placeLng={editingTransaction.place_lng || null}
                                onChange={(loc) => setEditingTransaction({
                                    ...editingTransaction,
                                    place_name: loc.place_name || undefined,
                                    place_address: loc.place_address || undefined,
                                    place_lat: loc.place_lat ?? undefined,
                                    place_lng: loc.place_lng ?? undefined,
                                })}
                            />
                            <DialogFooter className="pt-4 gap-2 sm:gap-0">
                                <DialogClose asChild>
                                    <Button type="button" variant="outline" className="rounded-xl">Cancel</Button>
                                </DialogClose>
                                <Button type="submit" className="rounded-xl bg-primary hover:bg-primary/90">Save Changes</Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            {isMapOpen && (
                <UIBoundary onReset={() => setIsMapOpen(false)}>
                    <ExpenseMapView
                        isOpen={isMapOpen}
                        onClose={() => setIsMapOpen(false)}
                        transactions={transactions}
                        formatCurrency={formatCurrency}
                        convertAmount={convertAmount}
                        currency={currency}
                    />
                </UIBoundary>
            )}

            <WelcomeModal
                isOpen={activeModal === 'welcome'}
                onClose={() => {
                    if (userId) {
                        localStorage.setItem(`welcome_seen_${userId}`, 'true');
                    }
                    const lastSeenId = userId
                        ? localStorage.getItem(`last_seen_feature_id_${userId}`)
                        : localStorage.getItem('last_seen_feature_id');
                    if (lastSeenId !== LATEST_FEATURE_ANNOUNCEMENT.id) {
                        setActiveModal('announcement');
                    } else {
                        setActiveModal(null);
                    }
                }}
            />

            <FeatureAnnouncementModal
                showAnnouncement={activeModal === 'announcement'}
                userId={userId}
                onClose={() => setActiveModal(null)}
            />

            <Suspense fallback={null}>
                <AddFundsDialog
                    isOpen={isAddFundsOpen}
                    onClose={() => setIsAddFundsOpen(false)}
                    userId={userId}
                    defaultBucketId={isBucketFocused ? dashboardFocus : undefined}
                    onSuccess={() => userId && loadTransactions(userId)}
                />
                <HowToUseDialog
                    isOpen={isHowToUseOpen}
                    onClose={() => setIsHowToUseOpen(false)}
                />
            </Suspense>
        </>
    );
}
