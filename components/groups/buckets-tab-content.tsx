import React, { useState } from 'react';
import Link from 'next/link';
import { Plus, Archive, Settings2, Trash2, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import { getBucketIcon } from '@/utils/icon-utils';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { type Bucket } from '@/components/providers/buckets-provider';
import { toast } from '@/utils/haptics';
import { BucketDialog } from './bucket-dialog';
import { BucketDetailSheet } from './bucket-detail-sheet';

interface BucketsTabContentProps {
    buckets: Bucket[];
    bucketSpending: Record<string, number>;
    formatCurrency: (amount: number, currencyCode?: string) => string;
    currency: string;
    archiveBucket: (id: string, archive: boolean) => Promise<void>;
    deleteBucket: (id: string) => Promise<void>;
}

export function BucketsTabContent({
    buckets, bucketSpending, formatCurrency,
    archiveBucket, deleteBucket,
}: BucketsTabContentProps) {
    const [isBucketDialogOpen, setIsBucketDialogOpen] = useState(false);
    const [editingBucket, setEditingBucket] = useState<Bucket | null>(null);
    const [detailBucket, setDetailBucket] = useState<Bucket | null>(null);
    const [archivedOpen, setArchivedOpen] = useState(false);

    const activeBuckets = buckets.filter(b => !b.is_archived);
    const archivedBuckets = buckets.filter(b => b.is_archived);
    const completedBuckets = archivedBuckets.filter(b => !!b.completed_at);

    const archivedLabel = completedBuckets.length === archivedBuckets.length
        ? 'Completed'
        : completedBuckets.length > 0
            ? 'Completed & archived'
            : 'Archived';

    const handleAddBucket = () => {
        setEditingBucket(null);
        setIsBucketDialogOpen(true);
    };

    const handleEditBucket = (bucket: Bucket) => {
        setEditingBucket(bucket);
        setIsBucketDialogOpen(true);
    };

    return (
        <div className="space-y-5">
            <BucketDialog
                isOpen={isBucketDialogOpen}
                onClose={() => setIsBucketDialogOpen(false)}
                editingBucket={editingBucket}
            />
            <BucketDetailSheet
                bucket={detailBucket}
                spent={detailBucket ? (bucketSpending[detailBucket.id] || 0) : 0}
                open={!!detailBucket}
                onOpenChange={(open) => !open && setDetailBucket(null)}
            />

            <section>
                <div className="flex items-baseline justify-between mb-2 px-1">
                    <h3 className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
                        Active buckets{activeBuckets.length > 0 ? ` · ${activeBuckets.length}` : ''}
                    </h3>
                    <button
                        type="button"
                        onClick={handleAddBucket}
                        className="inline-flex items-center gap-1 h-7 px-3 rounded-full text-[11px] font-semibold text-cyan-300 hover:text-cyan-200 hover:bg-cyan-400/10 transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        New bucket
                    </button>
                </div>

                {activeBuckets.length > 0 ? (
                    <div className="space-y-2">
                        {activeBuckets.map((bucket) => {
                            const spent = bucketSpending[bucket.id] || 0;
                            const budget = Number(bucket.budget);
                            const progress = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
                            const remaining = budget - spent;
                            const over = remaining < 0;
                            return (
                                <article
                                    key={bucket.id}
                                    onClick={() => setDetailBucket(bucket)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            setDetailBucket(bucket);
                                        }
                                    }}
                                    aria-label={`Open details for bucket ${bucket.name}`}
                                    className="relative overflow-hidden rounded-2xl border border-white/10 ring-1 ring-inset ring-cyan-400/15 bg-white/[0.035] hover:bg-white/[0.055] transition-colors cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.06),_0_6px_16px_-8px_rgba(0,0,0,0.55)]"
                                >
                                    <span className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r bg-cyan-400" aria-hidden="true" />
                                    <div className="p-4 pl-[18px] space-y-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-cyan-400/[0.08] text-cyan-400 p-2 shrink-0">
                                                    {getBucketIcon(bucket.icon)}
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="text-[15px] font-semibold tracking-tight truncate">{bucket.name}</h4>
                                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                                        {bucket.start_date && bucket.end_date
                                                            ? `${format(new Date(bucket.start_date), 'MMM d')} – ${format(new Date(bucket.end_date), 'MMM d, yy')}`
                                                            : 'Active'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-0.5 -mr-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={() => handleEditBucket(bucket)}
                                                    className="p-1.5 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-secondary/30 transition-colors"
                                                    title="Edit bucket"
                                                    aria-label={`Edit bucket ${bucket.name}`}
                                                >
                                                    <Settings2 className="w-3.5 h-3.5" aria-hidden="true" />
                                                </button>
                                                <button
                                                    onClick={() => archiveBucket(bucket.id, true)}
                                                    className="p-1.5 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-secondary/30 transition-colors"
                                                    title="Archive bucket"
                                                    aria-label={`Archive bucket ${bucket.name}`}
                                                >
                                                    <Archive className="w-3.5 h-3.5" aria-hidden="true" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        toast(`Delete ${bucket.name}?`, {
                                                            description: 'Transactions stay; the label is removed.',
                                                            action: {
                                                                label: 'Delete',
                                                                onClick: () => deleteBucket(bucket.id),
                                                            },
                                                        });
                                                    }}
                                                    className="p-1.5 rounded-full text-muted-foreground/60 hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
                                                    title="Delete bucket"
                                                    aria-label={`Delete bucket ${bucket.name}`}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                                </button>
                                            </div>
                                        </div>

                                        {budget > 0 && (
                                            <div className="space-y-1.5">
                                                <div className="flex items-baseline justify-between text-[11px]">
                                                    <span className="text-muted-foreground tabular-nums">
                                                        {formatCurrency(spent, bucket.currency)}
                                                        <span className="text-muted-foreground/50"> / {formatCurrency(budget, bucket.currency)}</span>
                                                    </span>
                                                    <span
                                                        className={cn(
                                                            'font-bold tabular-nums',
                                                            over ? 'text-rose-300' : 'text-cyan-300',
                                                        )}
                                                    >
                                                        {over ? `${formatCurrency(Math.abs(remaining), bucket.currency)} over` : `${formatCurrency(remaining, bucket.currency)} left`}
                                                    </span>
                                                </div>
                                                <div className="h-[3px] w-full bg-white/[0.04] rounded-full overflow-hidden">
                                                    <div
                                                        className={cn(
                                                            'h-full rounded-full transition-all duration-500',
                                                            progress >= 100 ? 'bg-rose-400' : progress >= 80 ? 'bg-amber-400' : 'bg-cyan-400',
                                                        )}
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                                {bucket.start_date && bucket.end_date && (
                                                    <p className="text-[10px] text-muted-foreground/60 italic">
                                                        ≈ {formatCurrency(budget / Math.max(1, differenceInDays(new Date(bucket.end_date), new Date(bucket.start_date)) / 30), bucket.currency)} per month
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                ) : archivedBuckets.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/[0.14] bg-white/[0.02] p-6 space-y-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        <div className="space-y-1.5">
                            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                                No active buckets
                            </p>
                            <h3 className="text-base font-semibold tracking-tight">
                                Track a private goal.
                            </h3>
                            <p className="text-[12px] text-muted-foreground leading-relaxed max-w-xs">
                                Group spending under a label — Trip to Lisbon, New iPhone, Wedding gift —
                                with a budget and date range.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleAddBucket}
                                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-cyan-400 text-cyan-950 text-[12px] font-semibold hover:bg-cyan-300 transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Create first bucket
                            </button>
                            <Link
                                href="/guide#buckets"
                                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors px-1"
                            >
                                How buckets work →
                            </Link>
                        </div>
                    </div>
                ) : null}
            </section>

            {archivedBuckets.length > 0 && (
                <section>
                    <button
                        type="button"
                        onClick={() => setArchivedOpen(v => !v)}
                        className="flex items-center gap-2 w-full px-1 py-2 text-left group"
                        aria-expanded={archivedOpen}
                    >
                        <Archive className="w-3 h-3 text-muted-foreground/50" />
                        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60 group-hover:text-foreground/70 transition-colors">
                            {archivedLabel} · {archivedBuckets.length}
                        </span>
                        <span className="h-px flex-1 bg-white/[0.05]" />
                        {archivedOpen
                            ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
                            : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />}
                    </button>

                    {archivedOpen && (
                        <ul className="space-y-px mt-2 rounded-xl overflow-hidden border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                            {archivedBuckets.map((bucket) => {
                                const isCompleted = !!bucket.completed_at;
                                return (
                                    <li key={bucket.id}>
                                        <div
                                            className={cn(
                                                'flex items-center gap-2.5 px-3 py-2.5 transition-colors',
                                                isCompleted ? 'bg-emerald-400/[0.06] hover:bg-emerald-400/[0.09]' : 'bg-white/[0.025] hover:bg-white/[0.05]',
                                            )}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => setDetailBucket(bucket)}
                                                className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                                            >
                                                <div
                                                    className={cn(
                                                        'w-7 h-7 rounded-lg flex items-center justify-center p-1.5 shrink-0',
                                                        isCompleted ? 'bg-emerald-400/10 text-emerald-300' : 'bg-secondary/10 text-muted-foreground/70',
                                                    )}
                                                >
                                                    {getBucketIcon(bucket.icon)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className={cn(
                                                        'text-[13px] font-medium truncate',
                                                        isCompleted ? 'text-emerald-200' : 'text-muted-foreground',
                                                    )}>
                                                        {bucket.name}
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground/60">
                                                        {isCompleted
                                                            ? `Completed ${format(new Date(bucket.completed_at!), 'MMM d, yy')}`
                                                            : 'Archived'}
                                                    </p>
                                                </div>
                                            </button>
                                            <div className="flex items-center gap-0.5 shrink-0">
                                                <button
                                                    onClick={() => archiveBucket(bucket.id, false)}
                                                    className="p-1.5 rounded-full text-muted-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors"
                                                    title="Unarchive bucket"
                                                    aria-label="Unarchive bucket"
                                                >
                                                    <RotateCcw className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        toast(`Delete ${bucket.name}?`, {
                                                            description: 'Transactions stay; the label is removed.',
                                                            action: {
                                                                label: 'Delete',
                                                                onClick: () => deleteBucket(bucket.id),
                                                            },
                                                        });
                                                    }}
                                                    className="p-1.5 rounded-full text-muted-foreground/60 hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
                                                    title="Delete bucket"
                                                    aria-label="Delete bucket"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>
            )}
        </div>
    );
}
