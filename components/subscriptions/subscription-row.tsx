'use client';

import { format, parseISO, formatDistanceToNowStrict, differenceInCalendarDays } from 'date-fns';
import {
    Tag, X, TrendingUp, TrendingDown, Star, Pause, Clock,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useBucketsList } from '@/components/providers/buckets-provider';
import { useWorkspaceTheme } from '@/hooks/useWorkspaceTheme';
import { cn } from '@/lib/utils';
import { getCategoryLabel, getIconForCategory, CATEGORY_COLORS } from '@/lib/categories';
import { getBucketIcon } from '@/utils/icon-utils';
import { getMeta, type Tpl, type LastCharge, type PriceChange } from '@/lib/subscriptions-utils';
import { RowActionsMenu } from './row-actions-menu';

interface Props {
    template: Tpl;
    lastCharge: LastCharge | undefined;
    onTogglePin: (t: Tpl) => void;
    onSetPause: (t: Tpl, dateStr: string | null) => void;
    onSetTrial: (t: Tpl, dateStr: string | null) => void;
    onAssignBucket: (t: Tpl, bucketId: string | null) => void;
    onCancel: (id: string) => void;
    onRequestPriceUpdate: (target: { template: Tpl; change: PriceChange }) => void;
}

export function SubscriptionRow({
    template, lastCharge,
    onTogglePin, onSetPause, onSetTrial, onAssignBucket, onCancel, onRequestPriceUpdate,
}: Props) {
    const { formatCurrency, convertAmount, currency } = useUserPreferences();
    const { buckets } = useBucketsList();
    const { theme: themeConfig } = useWorkspaceTheme();

    const meta = getMeta(template);
    const bucketId = meta.bucket_id ?? null;
    const linkedBucket = bucketId ? buckets.find(b => b.id === bucketId) : null;
    const drift = lastCharge && Math.abs(lastCharge.pctChange) >= 5
        ? { ...lastCharge, templateAmount: Number(template.amount) }
        : null;
    const paused = !!meta.pause_until && parseISO(meta.pause_until) > new Date();
    const trialEnds = meta.trial_ends_at ? parseISO(meta.trial_ends_at) : null;
    const trialActive = trialEnds && trialEnds > new Date();
    const trialEnded = trialEnds && trialEnds <= new Date();
    const showConvertedHint = template.currency && template.currency.toUpperCase() !== currency.toUpperCase();

    return (
        <Card
            className={cn(
                "bg-card/40 border-white/5 backdrop-blur-sm overflow-hidden group transition-opacity",
                paused && "opacity-60"
            )}
        >
            <CardContent className="p-4 flex items-center gap-4">
                <div className={cn("w-12 h-12 rounded-2xl flex flex-col items-center justify-center shrink-0 border", themeConfig.bg, themeConfig.border)}>
                    <span className={cn("text-[10px] font-bold uppercase leading-tight w-full text-center py-0.5 rounded-t-lg", themeConfig.text, themeConfig.headerBg)}>
                        {format(parseISO(template.next_occurrence), 'MMM')}
                    </span>
                    <span className="text-lg font-bold text-foreground">
                        {format(parseISO(template.next_occurrence), 'd')}
                    </span>
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-base truncate flex items-center gap-1.5">
                        {meta.pinned && (
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" aria-label="Pinned" />
                        )}
                        <span className="truncate">{template.description}</span>
                    </h4>
                    {lastCharge && (
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" aria-hidden="true" />
                            Last charged {formatDistanceToNowStrict(parseISO(lastCharge.lastDate), { addSuffix: true })}
                        </p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                        <span className="capitalize bg-secondary/50 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider">{template.frequency}</span>
                        <div className="flex items-center gap-1 opacity-70">
                            <div className="w-3.5 h-3.5 flex items-center justify-center">
                                {getIconForCategory(template.category, "w-full h-full", { style: { color: CATEGORY_COLORS[template.category] || CATEGORY_COLORS.others } })}
                            </div>
                            <span className="truncate">{getCategoryLabel(template.category)}</span>
                        </div>
                        <Popover>
                            <PopoverTrigger asChild>
                                <button
                                    type="button"
                                    className={cn(
                                        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border transition-colors",
                                        linkedBucket
                                            ? "bg-cyan-500/10 border-cyan-500/25 text-cyan-300 hover:bg-cyan-500/15"
                                            : "bg-secondary/30 border-white/5 text-muted-foreground/70 hover:text-foreground"
                                    )}
                                    aria-label={linkedBucket ? `Bucket: ${linkedBucket.name}, change` : 'Assign bucket'}
                                >
                                    {linkedBucket ? (
                                        <>
                                            <span className="w-2.5 h-2.5 inline-flex items-center justify-center">
                                                {getBucketIcon(linkedBucket.icon)}
                                            </span>
                                            <span className="truncate max-w-[80px]">{linkedBucket.name}</span>
                                        </>
                                    ) : (
                                        <>
                                            <Tag className="w-2.5 h-2.5" aria-hidden="true" />
                                            <span>Add to bucket</span>
                                        </>
                                    )}
                                </button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-56 p-1 bg-card/95 backdrop-blur-xl border-white/10">
                                <div className="max-h-64 overflow-y-auto">
                                    <button
                                        type="button"
                                        onClick={() => onAssignBucket(template, null)}
                                        className={cn(
                                            "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-secondary/30 transition-colors",
                                            !bucketId && "bg-secondary/20"
                                        )}
                                    >
                                        <X className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
                                        <span>No bucket</span>
                                    </button>
                                    {buckets.filter(b => !b.is_archived).map(b => (
                                        <button
                                            type="button"
                                            key={b.id}
                                            onClick={() => onAssignBucket(template, b.id)}
                                            className={cn(
                                                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-secondary/30 transition-colors",
                                                bucketId === b.id && "bg-cyan-500/10 text-cyan-300"
                                            )}
                                        >
                                            <span className="w-3 h-3 inline-flex items-center justify-center text-cyan-400">
                                                {getBucketIcon(b.icon)}
                                            </span>
                                            <span className="truncate">{b.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>
                        {paused && meta.pause_until && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border bg-amber-500/10 border-amber-500/25 text-amber-300">
                                <Pause className="w-2.5 h-2.5" aria-hidden="true" />
                                Paused until {format(parseISO(meta.pause_until), 'MMM d')}
                            </span>
                        )}
                        {trialActive && trialEnds && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border bg-rose-500/10 border-rose-500/25 text-rose-300">
                                Trial ends in {Math.max(0, differenceInCalendarDays(trialEnds, new Date()))}d
                            </span>
                        )}
                        {trialEnded && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border bg-secondary/30 border-white/5 text-muted-foreground/70">
                                Trial ended
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex flex-col items-end">
                        <span className="font-bold text-base">{formatCurrency(template.amount, template.currency)}</span>
                        {showConvertedHint && (
                            <span className="text-[10px] text-muted-foreground/70">
                                ≈ {formatCurrency(convertAmount(Number(template.amount), template.currency, currency))}
                            </span>
                        )}
                    </div>
                    {drift && (
                        <button
                            type="button"
                            onClick={() => onRequestPriceUpdate({ template, change: drift })}
                            className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold transition-colors",
                                drift.pctChange > 0
                                    ? "bg-rose-500/15 border-rose-500/30 text-rose-300 hover:bg-rose-500/25"
                                    : "bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25"
                            )}
                            aria-label="Update template price"
                        >
                            {drift.pctChange > 0
                                ? <TrendingUp className="w-3 h-3" aria-hidden="true" />
                                : <TrendingDown className="w-3 h-3" aria-hidden="true" />}
                            <span>
                                {drift.pctChange > 0 ? '+' : ''}
                                {drift.pctChange.toFixed(0)}%
                            </span>
                        </button>
                    )}
                    <RowActionsMenu
                        template={template}
                        meta={meta}
                        paused={paused}
                        onTogglePin={onTogglePin}
                        onSetPause={onSetPause}
                        onSetTrial={onSetTrial}
                        onCancel={onCancel}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
