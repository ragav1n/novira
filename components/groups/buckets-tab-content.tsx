import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Archive, Settings2, Trash2, RotateCcw, Tag } from 'lucide-react';
import { getBucketIcon } from '@/utils/icon-utils';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { type Bucket } from '@/components/providers/buckets-provider';
import { toast } from '@/utils/haptics';
import { BucketDialog } from './bucket-dialog';

interface BucketsTabContentProps {
    buckets: Bucket[];
    bucketSpending: Record<string, number>;
    formatCurrency: (amount: number, currencyCode?: string) => string;
    currency: string;
    archiveBucket: (id: string, archive: boolean) => Promise<void>;
    deleteBucket: (id: string) => Promise<void>;
}

export function BucketsTabContent({
    buckets, bucketSpending, formatCurrency, currency,
    archiveBucket, deleteBucket
}: BucketsTabContentProps) {
    const [isBucketDialogOpen, setIsBucketDialogOpen] = useState(false);
    const [editingBucket, setEditingBucket] = useState<Bucket | null>(null);

    const activeBuckets = buckets.filter(b => !b.is_archived);
    const archivedBuckets = buckets.filter(b => b.is_archived);

    const handleAddBucket = () => {
        setEditingBucket(null);
        setIsBucketDialogOpen(true);
    };

    const handleEditBucket = (bucket: Bucket) => {
        setEditingBucket(bucket);
        setIsBucketDialogOpen(true);
    };

    return (
        <div className="mt-6 space-y-6">
            <BucketDialog
                isOpen={isBucketDialogOpen}
                onClose={() => setIsBucketDialogOpen(false)}
                editingBucket={editingBucket}
            />

            <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Active Buckets</h3>
                    <Button
                        onClick={handleAddBucket}
                        size="sm"
                        variant="ghost"
                        className="h-8 rounded-xl bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500/20 gap-1.5 px-3 border border-cyan-500/20"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-bold">New Bucket</span>
                    </Button>
                </div>

                {activeBuckets.length > 0 ? (
                    activeBuckets.map((bucket) => {
                        const spent = bucketSpending[bucket.id] || 0;
                        const budget = Number(bucket.budget);
                        const progress = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
                        const remaining = budget - spent;

                        return (
                            <Card key={bucket.id} className="rounded-3xl overflow-hidden hover:bg-card/60 transition-colors border-white/5 bg-card/40">
                                <CardContent className="p-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center border bg-cyan-500/10 border-cyan-500/20 text-cyan-500 p-2.5 shrink-0">
                                                {getBucketIcon(bucket.icon)}
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-base truncate">{bucket.name}</h4>
                                                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-bold">
                                                    {bucket.start_date && bucket.end_date ? (
                                                        `${format(new Date(bucket.start_date), 'MMM d')} - ${format(new Date(bucket.end_date), 'MMM d, yy')}`
                                                    ) : 'Active Bucket'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleEditBucket(bucket)}
                                                className="p-2 rounded-full hover:bg-secondary/30 transition-colors"
                                                title="Edit Bucket"
                                            >
                                                <Settings2 className="w-4 h-4 text-muted-foreground" />
                                            </button>
                                            <button
                                                onClick={() => archiveBucket(bucket.id, true)}
                                                className="p-2 rounded-full hover:bg-secondary/30 transition-colors"
                                                title="Archive Bucket"
                                            >
                                                <Archive className="w-4 h-4 text-muted-foreground" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    toast(`Delete ${bucket.name}?`, {
                                                        description: "Transactions will stay, but the label will be removed.",
                                                        action: {
                                                            label: 'Delete',
                                                            onClick: () => deleteBucket(bucket.id)
                                                        }
                                                    })
                                                }}
                                                className="p-2 rounded-full hover:bg-rose-500/20 hover:text-rose-500 transition-colors"
                                                title="Delete Bucket"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {budget > 0 && (
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-[11px] font-bold uppercase tracking-tighter">
                                                <div className="flex flex-col">
                                                    <span className="text-muted-foreground">Spent: {formatCurrency(spent, bucket.currency)} / {formatCurrency(budget, bucket.currency)}</span>
                                                    {bucket.start_date && bucket.end_date && (
                                                        <span className="text-primary/60 lowercase italic font-normal">
                                                            ~{formatCurrency(budget / Math.max(1, differenceInDays(new Date(bucket.end_date), new Date(bucket.start_date)) / 30), bucket.currency)} / mo
                                                        </span>
                                                    )}
                                                </div>
                                                <span className={cn("flex flex-col items-end", remaining < 0 ? "text-rose-500" : "text-cyan-500")}>
                                                    <span>{remaining < 0 ? "Over budget by " : "Remaining: "}</span>
                                                    <span>{formatCurrency(Math.abs(remaining), bucket.currency)}</span>
                                                </span>
                                            </div>
                                            <div className="h-1.5 w-full bg-secondary/20 rounded-full overflow-hidden">
                                                <div
                                                    className={cn(
                                                        "h-full transition-all duration-500",
                                                        progress >= 100 ? "bg-rose-500" : progress >= 80 ? "bg-teal-500" : "bg-cyan-500"
                                                    )}
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })
                ) : archivedBuckets.length === 0 && (
                    <div className="text-center py-12 space-y-3 bg-secondary/5 rounded-3xl border border-dashed border-white/5">
                        <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center mx-auto">
                            <Tag className="w-8 h-8 text-cyan-500/30" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-bold">No active buckets</p>
                            <p className="text-[11px] text-muted-foreground px-8">Create a bucket to track private spending like a "Trip" or "Wedding Gift".</p>
                        </div>
                        <Button
                            onClick={handleAddBucket}
                            size="sm"
                            className="rounded-xl h-9 bg-cyan-500 hover:bg-cyan-600 text-white gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Create First Bucket
                        </Button>
                    </div>
                )}
            </div>

            {archivedBuckets.length > 0 && (
                <div className="pt-4 space-y-4">
                    <div className="flex items-center gap-2 px-1">
                        <Archive className="w-3 h-3 text-muted-foreground/40" />
                        <h3 className="text-[11px] font-bold text-muted-foreground/40 uppercase tracking-widest">Archived Buckets</h3>
                    </div>
                    {archivedBuckets.map((bucket) => (
                        <Card key={bucket.id} className="rounded-3xl overflow-hidden grayscale-[0.5] opacity-60 hover:opacity-100 transition-all border-white/5 bg-card/20 group">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center border bg-secondary/10 border-white/5 text-muted-foreground p-2 shrink-0">
                                        {getBucketIcon(bucket.icon)}
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="font-bold text-sm text-muted-foreground truncate">{bucket.name}</h4>
                                        <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-bold">Archived</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => archiveBucket(bucket.id, false)}
                                        className="p-2 rounded-full hover:bg-primary/20 hover:text-primary transition-colors"
                                        title="Unarchive Bucket"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => {
                                            toast(`Delete ${bucket.name}?`, {
                                                description: "Transactions will stay, but the label will be removed.",
                                                action: {
                                                    label: 'Delete',
                                                    onClick: () => deleteBucket(bucket.id)
                                                }
                                            })
                                        }}
                                        className="p-2 rounded-full hover:bg-rose-500/20 hover:text-rose-500 transition-colors"
                                        title="Delete Bucket"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
