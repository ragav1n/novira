'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subYears } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Download, Calendar, Tag, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBucketsList } from '@/components/providers/buckets-provider';
import { useIsMobile } from '@/components/ui/use-mobile';
import { getBucketIcon } from '@/utils/icon-utils';

import { useGroups } from '@/components/providers/groups-provider';

interface ExportDateRangeModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onExport: (range: DateRange | null, bucketId: string | null, groupId: string | 'personal' | null) => void;
    title?: string;
    description?: string;
    loading?: boolean;
}

export function ExportDateRangeModal({
    isOpen,
    onOpenChange,
    onExport,
    title = "Export Data",
    description = "Select a date range to export your transaction history.",
    loading = false
}: ExportDateRangeModalProps) {
    const isMobile = useIsMobile();
    const { buckets } = useBucketsList();
    const { groups } = useGroups();
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
    const [selectedBucketId, setSelectedBucketId] = useState<string | null>(null);
    const [selectedGroupId, setSelectedGroupId] = useState<string | 'personal' | null>(null);

    const eligibleGroups = groups.filter(g => g.type === 'couple' || g.type === 'home');
    
    // Automatically select the active workspace if any, otherwise all
    // Since we don't have activeWorkspaceContext here directly, we leave it as 'null' (All) by default.

    const handlePresetSelect = (preset: string) => {
        const now = new Date();
        let range: DateRange | undefined;

        switch (preset) {
            case 'current_month':
                range = { from: startOfMonth(now), to: endOfMonth(now) };
                break;
            case 'last_month':
                const lastMonth = subMonths(now, 1);
                range = { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
                break;
            case 'last_3_months':
                range = { from: subMonths(now, 3), to: now };
                break;
            case 'last_6_months':
                range = { from: subMonths(now, 6), to: now };
                break;
            case 'this_year':
                range = { from: startOfYear(now), to: endOfYear(now) };
                break;
            case 'last_year':
                const lastYear = subYears(now, 1);
                range = { from: startOfYear(lastYear), to: endOfYear(lastYear) };
                break;
            case 'all_time':
                range = undefined; // Special case for all time
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
        let range: DateRange | null = null;
        if (selectedPreset === 'all_time') {
            range = null;
        } else if (dateRange?.from) {
            range = dateRange;
        }

        onExport(range, selectedBucketId, selectedGroupId);
    };

    // Auto-select 'current_month' on open if nothing selected?
    // Or just leave empty.

    const presets = [
        { id: 'current_month', label: 'This Month' },
        { id: 'last_month', label: 'Last Month' },
        { id: 'last_3_months', label: 'Last 3M' },
        { id: 'last_6_months', label: 'Last 6M' },
        { id: 'this_year', label: 'This Year' },
        { id: 'all_time', label: 'All Time' },
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-background border-white/10 p-3 sm:p-5 gap-3">
                <DialogHeader className="gap-0.5">
                    <DialogTitle className="text-base">{title}</DialogTitle>
                    <DialogDescription className="text-[10px] leading-tight">{description}</DialogDescription>
                </DialogHeader>

                <div className="grid gap-2.5 py-1 max-h-[75vh] overflow-y-auto scrollbar-hide pr-1">
                    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                        {presets.map((preset) => (
                            <Button
                                key={preset.id}
                                variant="outline"
                                onClick={() => handlePresetSelect(preset.id)}
                                className={cn(
                                    "flex-none font-normal h-7 text-[10px] px-2.5",
                                    selectedPreset === preset.id && "bg-primary/20 border-primary text-primary hover:bg-primary/25"
                                )}
                            >
                                {preset.label}
                            </Button>
                        ))}
                    </div>

                    <div className="space-y-1">
                        <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest opacity-70">Custom Range</p>
                        <DateRangePicker
                            date={dateRange}
                            setDate={handleCustomDateChange}
                            align={isMobile ? "center" : "start"}
                            className="w-full h-8"
                        />
                    </div>

                    {/* Workspace Filter */}
                    <div className="space-y-1">
                        <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest opacity-70">Context</p>
                        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                            <div
                                onClick={() => setSelectedGroupId(null)}
                                className={cn(
                                    "flex items-center justify-center px-3 py-1 rounded-lg border transition-all cursor-pointer whitespace-nowrap",
                                    selectedGroupId === null
                                        ? "bg-primary text-white border-primary"
                                        : "bg-secondary/10 border-white/5 hover:border-white/10"
                                )}
                            >
                                <span className="text-[10px] font-bold">All</span>
                            </div>
                            <div
                                onClick={() => setSelectedGroupId('personal')}
                                className={cn(
                                    "flex items-center justify-center px-3 py-1 rounded-lg border transition-all cursor-pointer whitespace-nowrap",
                                    selectedGroupId === 'personal'
                                        ? "bg-primary text-white border-primary"
                                        : "bg-secondary/10 border-white/5 hover:border-white/10"
                                )}
                            >
                                <span className="text-[10px] font-bold">Personal</span>
                            </div>
                            {eligibleGroups.map((group) => (
                                <div
                                    key={group.id}
                                    onClick={() => setSelectedGroupId(group.id)}
                                    className={cn(
                                        "flex items-center justify-center px-3 py-1 rounded-lg border transition-all cursor-pointer whitespace-nowrap",
                                        selectedGroupId === group.id
                                            ? "bg-primary text-white border-primary"
                                            : "bg-secondary/10 border-white/5 hover:border-white/10"
                                    )}
                                >
                                    <span className="text-[10px] font-bold">{group.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Bucket Filter */}
                    {buckets.length > 0 && (
                        <div className="space-y-1">
                            <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest opacity-70">Bucket (Optional)</p>
                            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                                <div
                                    onClick={() => setSelectedBucketId(null)}
                                    className={cn(
                                        "flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all min-w-[70px] cursor-pointer",
                                        !selectedBucketId
                                            ? "bg-primary/20 border-primary/50"
                                            : "bg-secondary/10 border-white/5 hover:border-white/10"
                                    )}
                                >
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-secondary/20 border border-white/5">
                                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                                    </div>
                                    <span className="text-[11px] font-medium truncate w-14 text-center">All</span>
                                </div>
                                {buckets.map((bucket) => (
                                    <div
                                        key={bucket.id}
                                        onClick={() => setSelectedBucketId(bucket.id)}
                                        className={cn(
                                            "flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all min-w-[70px] cursor-pointer",
                                            selectedBucketId === bucket.id
                                                ? "bg-cyan-500/20 border-cyan-500"
                                                : "bg-secondary/10 border-white/5 hover:border-white/10"
                                        )}
                                    >
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-lg bg-secondary/20 border border-white/5 p-1.5 text-cyan-500">
                                            {getBucketIcon(bucket.icon || 'Tag')}
                                        </div>
                                        <span className="text-[11px] font-medium truncate w-14 text-center">{bucket.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex-row items-center gap-2 mt-1">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading} className="flex-1 h-8 text-xs underline underline-offset-4 hover:bg-transparent">
                        Cancel
                    </Button>
                    <Button onClick={handleExportClick} disabled={loading || (!dateRange && selectedPreset !== 'all_time')} className="flex-[2] h-9 text-xs font-bold">
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                <span>Exporting...</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Download className="w-4 h-4" />
                                <span>Export</span>
                            </div>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
