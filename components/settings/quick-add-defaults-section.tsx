'use client';

import { Layers, Tag, Wallet } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CATEGORIES } from '@/lib/categories';
import type { Bucket } from '@/components/providers/buckets-provider';

const PAYMENT_METHODS = ['Cash', 'UPI', 'Debit Card', 'Credit Card', 'Bank Transfer'] as const;

interface Props {
    defaultCategory: string | null;
    setDefaultCategory: (cat: string | null) => Promise<void> | void;
    defaultPaymentMethod: string | null;
    setDefaultPaymentMethod: (pm: string | null) => Promise<void> | void;
    defaultBucketId: string | null;
    setDefaultBucketId: (id: string | null) => Promise<void> | void;
    buckets: Bucket[];
}

const NONE = '__none__';

export function QuickAddDefaultsSection({
    defaultCategory,
    setDefaultCategory,
    defaultPaymentMethod,
    setDefaultPaymentMethod,
    defaultBucketId,
    setDefaultBucketId,
    buckets,
}: Props) {
    const activeBuckets = buckets.filter((b) => !b.is_archived && !b.completed_at);

    return (
        <div className="bg-secondary/5 rounded-xl border border-white/5 divide-y divide-white/5">
            <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3 min-w-0">
                    <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                        <p className="text-sm font-medium">Default Category</p>
                        <p className="text-[11px] text-muted-foreground">
                            Pre-selected when adding an expense
                        </p>
                    </div>
                </div>
                <Select
                    value={defaultCategory ?? NONE}
                    onValueChange={(val) => setDefaultCategory(val === NONE ? null : val)}
                >
                    <SelectTrigger className="w-[140px] h-9 rounded-xl bg-secondary/20 border-white/10 text-xs font-bold">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NONE}>Last used</SelectItem>
                        {CATEGORIES.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3 min-w-0">
                    <Wallet className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                        <p className="text-sm font-medium">Default Payment Method</p>
                        <p className="text-[11px] text-muted-foreground">
                            Pre-selected when adding an expense
                        </p>
                    </div>
                </div>
                <Select
                    value={defaultPaymentMethod ?? NONE}
                    onValueChange={(val) => setDefaultPaymentMethod(val === NONE ? null : val)}
                >
                    <SelectTrigger className="w-[150px] h-9 rounded-xl bg-secondary/20 border-white/10 text-xs font-bold">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NONE}>Last used</SelectItem>
                        {PAYMENT_METHODS.map((m) => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3 min-w-0">
                    <Layers className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                        <p className="text-sm font-medium">Default Bucket</p>
                        <p className="text-[11px] text-muted-foreground">
                            Auto-attach new expenses to this bucket
                        </p>
                    </div>
                </div>
                <Select
                    value={defaultBucketId ?? NONE}
                    onValueChange={(val) => setDefaultBucketId(val === NONE ? null : val)}
                >
                    <SelectTrigger className="w-[150px] h-9 rounded-xl bg-secondary/20 border-white/10 text-xs font-bold">
                        <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NONE}>None</SelectItem>
                        {activeBuckets.map((b) => (
                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
