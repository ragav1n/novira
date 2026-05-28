'use client';

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import {
    startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subYears,
    format, differenceInDays,
} from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Download, Tag, Layers, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBucketsList } from '@/components/providers/buckets-provider';
import { useIsMobile } from '@/components/ui/use-mobile';
import { getBucketIcon } from '@/utils/icon-utils';
import { motion, LayoutGroup } from 'framer-motion';

import { useGroups } from '@/components/providers/groups-provider';

interface ExportDateRangeModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onExport: (range: DateRange | null, bucketId: string | null, groupId: string | 'personal' | null) => void;
    title?: string;
    description?: string;
    loading?: boolean;
}

const PRESETS: { id: string; label: string }[] = [
    { id: 'current_month', label: 'This Month' },
    { id: 'last_month',    label: 'Last Month' },
    { id: 'last_3_months', label: 'Last 3M' },
    { id: 'last_6_months', label: 'Last 6M' },
    { id: 'this_year',     label: 'This Year' },
    { id: 'all_time',      label: 'All Time' },
];

const presetLabel = (id: string | null) => PRESETS.find(p => p.id === id)?.label ?? null;

const SPRING = { type: 'spring' as const, stiffness: 400, damping: 32 };

// Format identity — rose for PDF (printed report), emerald for CSV (spreadsheet).
const FORMAT_ACCENT = {
    pdf: {
        stripe: 'bg-rose-400',
        chipText: 'text-rose-200',
        chipBorder: 'border-rose-400/30',
        backdrop:
            'bg-[radial-gradient(ellipse_120%_70%_at_50%_0%,_rgba(244,63,94,0.20),_transparent_65%)]',
    },
    csv: {
        stripe: 'bg-emerald-400',
        chipText: 'text-emerald-200',
        chipBorder: 'border-emerald-400/30',
        backdrop:
            'bg-[radial-gradient(ellipse_120%_70%_at_50%_0%,_rgba(16,185,129,0.20),_transparent_65%)]',
    },
} as const;

export function ExportDateRangeModal({
    isOpen,
    onOpenChange,
    onExport,
    title = 'Export Data',
    description = 'Select a date range to export your transaction history.',
    loading = false,
}: ExportDateRangeModalProps) {
    const isMobile = useIsMobile();
    const { buckets } = useBucketsList();
    const { groups } = useGroups();
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
    const [selectedBucketId, setSelectedBucketId] = useState<string | null>(null);
    const [selectedGroupId, setSelectedGroupId] = useState<string | 'personal' | null>(null);

    const eligibleGroups = groups.filter(g => g.type === 'couple' || g.type === 'home');

    const fileFormat = (title || '').toLowerCase().includes('csv') ? 'csv' : 'pdf';
    const accent = FORMAT_ACCENT[fileFormat];
    const filenamePreview = `novira_export_${format(new Date(), 'yyyyMMdd')}.${fileFormat}`;

    const handlePresetSelect = (preset: string) => {
        const now = new Date();
        let range: DateRange | undefined;
        switch (preset) {
            case 'current_month':
                range = { from: startOfMonth(now), to: endOfMonth(now) };
                break;
            case 'last_month': {
                const lastMonth = subMonths(now, 1);
                range = { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
                break;
            }
            case 'last_3_months':
                range = { from: subMonths(now, 3), to: now };
                break;
            case 'last_6_months':
                range = { from: subMonths(now, 6), to: now };
                break;
            case 'this_year':
                range = { from: startOfYear(now), to: endOfYear(now) };
                break;
            case 'last_year': {
                const lastYear = subYears(now, 1);
                range = { from: startOfYear(lastYear), to: endOfYear(lastYear) };
                break;
            }
            case 'all_time':
                range = undefined;
                break;
        }
        setDateRange(range);
        setSelectedPreset(preset);
    };

    const handleCustomDateChange = (range: DateRange | undefined) => {
        setDateRange(range);
        setSelectedPreset('custom');
    };

    const handleExportClick = () => {
        const range: DateRange | null = selectedPreset === 'all_time'
            ? null
            : dateRange?.from ? dateRange : null;
        onExport(range, selectedBucketId, selectedGroupId);
    };

    const periodSummary = useMemo(() => {
        if (selectedPreset === 'all_time') return 'All time';
        if (selectedPreset && selectedPreset !== 'custom') return presetLabel(selectedPreset);
        if (dateRange?.from && dateRange?.to) {
            const days = differenceInDays(dateRange.to, dateRange.from) + 1;
            const sameYear = dateRange.from.getFullYear() === dateRange.to.getFullYear();
            const left = format(dateRange.from, sameYear ? 'MMM d' : 'MMM d, yyyy');
            const right = format(dateRange.to, 'MMM d, yyyy');
            return `${left} – ${right} · ${days}d`;
        }
        if (dateRange?.from) return `From ${format(dateRange.from, 'MMM d, yyyy')}`;
        return null;
    }, [selectedPreset, dateRange]);

    const contextLabel = (() => {
        if (selectedGroupId === null) return 'All workspaces';
        if (selectedGroupId === 'personal') return 'Personal';
        return groups.find(g => g.id === selectedGroupId)?.name ?? 'Workspace';
    })();

    const bucketLabel = selectedBucketId
        ? buckets.find(b => b.id === selectedBucketId)?.name ?? null
        : null;

    const scopeDisplay = bucketLabel ? `${contextLabel} · ${bucketLabel}` : contextLabel;
    const isExportDisabled = loading || (!dateRange && selectedPreset !== 'all_time');

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent
                className="sm:max-w-md p-0 gap-0 overflow-hidden rounded-3xl border-white/10 bg-card/95 backdrop-blur-xl"
            >
                {/* ── Hero ──────────────────────────────────────────────────── */}
                <div className="relative px-6 pt-6 pb-4 text-center">
                    <div aria-hidden className={cn('absolute inset-x-0 top-0 h-36', accent.backdrop)} />
                    <div className="relative flex flex-col items-center gap-3">
                        <DocumentHeroIcon format={fileFormat} stripe={accent.stripe} />
                        <DialogHeader className="gap-1 sm:text-center items-center">
                            <DialogTitle className="text-base font-semibold tracking-tight">{title}</DialogTitle>
                            <p className="font-mono text-[11px] text-muted-foreground/80 truncate max-w-full">
                                {filenamePreview}
                            </p>
                            <DialogDescription className="sr-only">{description}</DialogDescription>
                        </DialogHeader>
                    </div>
                </div>

                {/* ── Body ──────────────────────────────────────────────────── */}
                <div className="px-4 sm:px-5 pb-2 grid gap-3 max-h-[64vh] overflow-y-auto scrollbar-hide">
                    {/* Period card */}
                    <section className="rounded-2xl border border-white/[0.08] bg-card/40 backdrop-blur-xl p-3 sm:p-3.5">
                        <div className="mb-2 flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-widest text-muted-foreground/80">
                            <Calendar className="h-3 w-3" /> Period
                        </div>
                        <LayoutGroup id="export-preset">
                            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-6">
                                {PRESETS.map(p => (
                                    <SelectableButton
                                        key={p.id}
                                        layoutKey="export-preset-highlight"
                                        selected={selectedPreset === p.id}
                                        onClick={() => handlePresetSelect(p.id)}
                                        height="h-9"
                                    >
                                        {p.label}
                                    </SelectableButton>
                                ))}
                            </div>
                        </LayoutGroup>

                        <div className="mt-3 border-t border-white/[0.06] pt-3">
                            <div className="mb-1.5 flex items-center justify-between">
                                <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/70">
                                    Custom range
                                </span>
                                {periodSummary && selectedPreset !== 'custom' && (
                                    <span className="text-[10.5px] text-muted-foreground/70">{periodSummary}</span>
                                )}
                            </div>
                            <DateRangePicker
                                date={dateRange}
                                setDate={handleCustomDateChange}
                                align={isMobile ? 'center' : 'start'}
                                className="w-full"
                            />
                        </div>
                    </section>

                    {/* Scope card */}
                    <section className="rounded-2xl border border-white/[0.08] bg-card/40 backdrop-blur-xl p-3 sm:p-3.5 space-y-3">
                        <div>
                            <div className="mb-2 flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-widest text-muted-foreground/80">
                                <Layers className="h-3 w-3" /> Context
                            </div>
                            <LayoutGroup id="export-context">
                                <div className="flex flex-wrap gap-1.5">
                                    <ScopeChip
                                        label="All"
                                        selected={selectedGroupId === null}
                                        onClick={() => setSelectedGroupId(null)}
                                    />
                                    <ScopeChip
                                        label="Personal"
                                        selected={selectedGroupId === 'personal'}
                                        onClick={() => setSelectedGroupId('personal')}
                                    />
                                    {eligibleGroups.map(g => (
                                        <ScopeChip
                                            key={g.id}
                                            label={g.name}
                                            selected={selectedGroupId === g.id}
                                            onClick={() => setSelectedGroupId(g.id)}
                                        />
                                    ))}
                                </div>
                            </LayoutGroup>
                        </div>

                        {buckets.length > 0 && (
                            <div>
                                <div className="mb-2 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-widest text-muted-foreground/80">
                                        <Tag className="h-3 w-3" /> Bucket
                                    </div>
                                    <span className="text-[9.5px] text-muted-foreground/50">Optional</span>
                                </div>
                                <LayoutGroup id="export-bucket">
                                    <div className="flex flex-wrap gap-1.5">
                                        <ScopeChip
                                            label="All"
                                            selected={!selectedBucketId}
                                            onClick={() => setSelectedBucketId(null)}
                                        />
                                        {buckets.map(b => (
                                            <ScopeChip
                                                key={b.id}
                                                label={b.name}
                                                selected={selectedBucketId === b.id}
                                                onClick={() => setSelectedBucketId(b.id)}
                                                icon={
                                                    <span className={cn(
                                                        'flex h-4 w-4 items-center justify-center',
                                                        selectedBucketId === b.id ? 'text-primary' : 'text-cyan-400/80',
                                                    )}>
                                                        {getBucketIcon(b.icon || 'Tag')}
                                                    </span>
                                                }
                                            />
                                        ))}
                                    </div>
                                </LayoutGroup>
                            </div>
                        )}
                    </section>
                </div>

                {/* ── Footer ────────────────────────────────────────────────── */}
                <div className="px-4 sm:px-5 pt-3 pb-4 sm:pb-5">
                    <div className="mb-2.5 grid grid-cols-2 gap-2 rounded-xl border border-white/[0.06] bg-secondary/10 px-3 py-2">
                        <SummaryCell label="Period" value={periodSummary} />
                        <SummaryCell label="Scope" value={scopeDisplay} align="right" />
                    </div>
                    <motion.div whileTap={isExportDisabled ? undefined : { scale: 0.98 }}>
                        <Button
                            onClick={handleExportClick}
                            disabled={isExportDisabled}
                            className={cn(
                                'h-11 w-full rounded-2xl text-xs font-semibold',
                                'bg-gradient-to-b from-primary to-primary/85 hover:from-primary hover:to-primary',
                                'shadow-[0_12px_36px_-14px_rgba(138,43,226,0.75)]',
                            )}
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                                    Exporting…
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <Download className="h-4 w-4" />
                                    Export {fileFormat.toUpperCase()}
                                </span>
                            )}
                        </Button>
                    </motion.div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ── Building blocks ────────────────────────────────────────────────────────

interface SelectableButtonProps {
    children: React.ReactNode;
    selected: boolean;
    onClick: () => void;
    layoutKey: string;
    height?: string;
}

function SelectableButton({ children, selected, onClick, layoutKey, height = 'h-8' }: SelectableButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'relative isolate flex items-center justify-center rounded-xl border text-[11px] font-medium whitespace-nowrap transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                height,
                selected
                    ? 'border-primary/60 text-primary'
                    : 'border-white/[0.07] bg-secondary/10 text-foreground/80 hover:border-white/15 hover:bg-secondary/20',
            )}
        >
            {selected && (
                <motion.span
                    layoutId={layoutKey}
                    transition={SPRING}
                    aria-hidden
                    className="absolute inset-0 -z-10 rounded-xl bg-primary/25 shadow-[inset_0_0_0_1px_rgba(138,43,226,0.45),0_6px_18px_-10px_rgba(138,43,226,0.55)]"
                />
            )}
            <span className="relative">{children}</span>
        </button>
    );
}

interface ScopeChipProps {
    label: string;
    selected: boolean;
    onClick: () => void;
    icon?: React.ReactNode;
}

function ScopeChip({ label, selected, onClick, icon }: ScopeChipProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'relative isolate flex items-center gap-1.5 rounded-full border px-3 h-7 text-[11px] font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                selected
                    ? 'border-primary/60 text-primary'
                    : 'border-white/[0.07] bg-secondary/10 text-foreground/80 hover:border-white/15 hover:bg-secondary/20',
            )}
        >
            {selected && (
                <motion.span
                    layoutId="export-chip-highlight"
                    transition={SPRING}
                    aria-hidden
                    className="absolute inset-0 -z-10 rounded-full bg-primary/25 shadow-[inset_0_0_0_1px_rgba(138,43,226,0.45)]"
                />
            )}
            {icon}
            <span className="relative truncate max-w-[120px]">{label}</span>
        </button>
    );
}

function SummaryCell({
    label, value, align = 'left',
}: { label: string; value: string | null | undefined; align?: 'left' | 'right' }) {
    return (
        <div className={cn('flex flex-col gap-0.5', align === 'right' && 'items-end text-right')}>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/55">
                {label}
            </span>
            <span className={cn(
                'text-[11px] font-medium truncate max-w-full',
                value ? 'text-foreground/90' : 'text-muted-foreground/40',
            )}>
                {value || '—'}
            </span>
        </div>
    );
}

// Stylized faux-document hero. Reads as "a real file you're about to download".
function DocumentHeroIcon({ format, stripe }: { format: 'pdf' | 'csv'; stripe: string }) {
    return (
        <div className="relative h-[72px] w-[56px]">
            {/* Back page — only for PDF (multi-page) */}
            {format === 'pdf' && (
                <div
                    aria-hidden
                    className="absolute inset-0 -translate-x-1 translate-y-1 rotate-[6deg] rounded-lg border border-white/10 bg-card/70 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)]"
                />
            )}
            {/* Front page */}
            <div
                aria-hidden
                className="absolute inset-0 -rotate-[4deg] rounded-lg border border-white/15 bg-card/90 shadow-[0_14px_36px_-14px_rgba(0,0,0,0.7)] overflow-hidden"
            >
                <div className={cn('h-1.5 w-full', stripe)} />
                {/* Faux content lines */}
                <div className="px-2 pt-3 space-y-1.5">
                    <div className="h-[2px] w-9 rounded-full bg-white/25" />
                    <div className="h-[2px] w-7 rounded-full bg-white/15" />
                    <div className="h-[2px] w-10 rounded-full bg-white/15" />
                    <div className="h-[2px] w-6 rounded-full bg-white/15" />
                </div>
                {/* Tucked corner */}
                <div
                    aria-hidden
                    className="absolute bottom-0 right-0 h-3 w-3 bg-card/60"
                    style={{ clipPath: 'polygon(100% 0, 0 100%, 100% 100%)' }}
                />
                {/* Extension chip */}
                <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2">
                    <span className="rounded border border-white/15 bg-card/90 px-1.5 py-[1px] text-[8px] font-bold tracking-widest text-foreground/85">
                        {format.toUpperCase()}
                    </span>
                </div>
            </div>
        </div>
    );
}
