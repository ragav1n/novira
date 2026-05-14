'use client';

import React from 'react';
import {
    SlidersHorizontal, X, Check, Calendar as CalendarIcon, Tag, Plane, Home, Gift,
    Car, Utensils, ShoppingCart, Heart, Gamepad2, School, Laptop, Music,
} from 'lucide-react';
import { format } from 'date-fns';
import {
    Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
    SheetTrigger, SheetFooter, SheetClose,
} from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { CATEGORY_COLORS, getIconForCategory, CATEGORIES as SYSTEM_CATEGORIES } from '@/lib/categories';
import { cn } from '@/lib/utils';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useBucketsList } from '@/components/providers/buckets-provider';
import { useWorkspaceTheme } from '@/hooks/useWorkspaceTheme';
import type { DateRange, SortOption } from '@/lib/search-utils';

const paymentMethods = ['Cash', 'UPI', 'Debit Card', 'Credit Card', 'Bank Transfer'];

const bucketIcons: Record<string, React.ElementType> = {
    Tag, Plane, Home, Gift, Car, Utensils, ShoppingCart,
    Heart, Gamepad2, School, Laptop, Music,
};

function BucketIcon({ name }: { name?: string }) {
    const Icon = bucketIcons[name || 'Tag'] || Tag;
    return <Icon className="w-full h-full" />;
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    activeFilterCount: number;
    sortBy: SortOption;
    setSortBy: (v: SortOption) => void;
    priceRange: [number, number];
    setPriceRange: (v: [number, number]) => void;
    maxPossiblePrice: number;
    dateRange: DateRange;
    setDateRange: (v: DateRange) => void;
    selectedBucketId: string | null;
    setSelectedBucketId: (id: string | null) => void;
    knownTags: string[];
    selectedTags: string[];
    setSelectedTags: React.Dispatch<React.SetStateAction<string[]>>;
    selectedCategories: string[];
    setSelectedCategories: React.Dispatch<React.SetStateAction<string[]>>;
    selectedPayments: string[];
    setSelectedPayments: React.Dispatch<React.SetStateAction<string[]>>;
    onReset: () => void;
}

export function SearchFilterSheet({
    open, onOpenChange, activeFilterCount,
    sortBy, setSortBy,
    priceRange, setPriceRange, maxPossiblePrice,
    dateRange, setDateRange,
    selectedBucketId, setSelectedBucketId,
    knownTags, selectedTags, setSelectedTags,
    selectedCategories, setSelectedCategories,
    selectedPayments, setSelectedPayments,
    onReset,
}: Props) {
    const { formatCurrency } = useUserPreferences();
    const { buckets } = useBucketsList();
    const { theme: themeConfig } = useWorkspaceTheme();

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl bg-secondary/10 border-white/10 relative">
                    <SlidersHorizontal className="w-4 h-4" />
                    {activeFilterCount > 0 && (
                        <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center font-bold text-[11px] ${themeConfig.bgSolid} ${themeConfig.textWhite}`}>
                            {activeFilterCount}
                        </span>
                    )}
                </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px] border-white/5 bg-background p-0 flex flex-col">
                <SheetHeader className="p-6 pb-2">
                    <SheetTitle>Filter & Sort</SheetTitle>
                    <SheetDescription>Refine your transaction search.</SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-8">
                    <div className="space-y-3">
                        <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Sort By</Label>
                        <Select value={sortBy} onValueChange={(val: SortOption) => setSortBy(val)}>
                            <SelectTrigger className="w-full bg-secondary/10 border-white/10 h-11 rounded-xl">
                                <SelectValue placeholder="Sort by" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="date-desc">Newest First</SelectItem>
                                <SelectItem value="date-asc">Oldest First</SelectItem>
                                <SelectItem value="amount-desc">Highest Amount</SelectItem>
                                <SelectItem value="amount-asc">Lowest Amount</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between">
                            <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Price Range</Label>
                            <span className={`text-xs font-mono font-bold ${themeConfig.text}`}>
                                {formatCurrency(priceRange[0])} - {formatCurrency(priceRange[1])}
                            </span>
                        </div>
                        <Slider
                            defaultValue={[0, maxPossiblePrice]}
                            max={maxPossiblePrice}
                            step={10}
                            value={priceRange}
                            onValueChange={(val) => setPriceRange(val as [number, number])}
                            className="py-4"
                        />
                    </div>

                    <div className="space-y-3">
                        <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Date Range</Label>
                        <Popover modal={true}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "w-full justify-start text-left font-normal h-11 rounded-xl bg-secondary/10 border-white/10 hover:bg-secondary/20",
                                        !dateRange.from && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRange.from ? (
                                        dateRange.to ? (
                                            <>
                                                {format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd")}
                                            </>
                                        ) : (
                                            format(dateRange.from, "LLL dd, y")
                                        )
                                    ) : (
                                        <span>Pick a date range</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 border-white/5 bg-background shadow-2xl" align="end">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={dateRange.from}
                                    selected={{ from: dateRange.from, to: dateRange.to }}
                                    onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                                    numberOfMonths={1}
                                    fromDate={new Date(2020, 0, 1)}
                                    toDate={new Date(2030, 11, 31)}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    {buckets.length > 0 && (
                        <div className="space-y-3">
                            <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Bucket (Private)</Label>
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                <div
                                    onClick={() => setSelectedBucketId(null)}
                                    className={cn(
                                        "flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all min-w-[70px] cursor-pointer",
                                        !selectedBucketId
                                            ? `${themeConfig.bgMedium} ${themeConfig.borderMedium}`
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
                                                ? "bg-cyan-500/20 border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.1)]"
                                                : "bg-secondary/10 border-white/5 hover:border-white/10"
                                        )}
                                    >
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-secondary/20 border border-white/5">
                                            <div className="w-4 h-4 text-cyan-500">
                                                <BucketIcon name={bucket.icon} />
                                            </div>
                                        </div>
                                        <span className="text-[11px] font-medium truncate w-14 text-center">{bucket.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {knownTags.length > 0 && (
                        <div className="space-y-3">
                            <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Tags</Label>
                            <div className="flex flex-wrap gap-1.5">
                                {knownTags.slice(0, 30).map((t) => {
                                    const active = selectedTags.includes(t);
                                    return (
                                        <button
                                            type="button"
                                            key={t}
                                            onClick={() => setSelectedTags(prev => active ? prev.filter(x => x !== t) : [...prev, t])}
                                            className={cn(
                                                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors",
                                                active
                                                    ? "bg-primary/20 border-primary/40 text-primary"
                                                    : "bg-secondary/10 border-white/5 text-muted-foreground hover:border-white/10"
                                            )}
                                        >
                                            #{t}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Categories</Label>
                        <div className="grid grid-cols-1 gap-2">
                            {SYSTEM_CATEGORIES.map((cat) => (
                                <div
                                    key={cat.id}
                                    className={cn(
                                        "flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer",
                                        selectedCategories.includes(cat.id)
                                            ? `${themeConfig.bgMedium} ${themeConfig.borderMedium}`
                                            : "bg-secondary/10 border-white/5 hover:border-white/10"
                                    )}
                                    onClick={() => {
                                        setSelectedCategories(prev =>
                                            prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                                        );
                                    }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-8 h-8 rounded-full flex items-center justify-center border"
                                            style={{
                                                backgroundColor: `${CATEGORY_COLORS[cat.id] || '#8A2BE2'}20`,
                                                borderColor: `${CATEGORY_COLORS[cat.id] || '#8A2BE2'}40`
                                            }}
                                        >
                                            {React.cloneElement(getIconForCategory(cat.id) as React.ReactElement<{ style?: React.CSSProperties }>, {
                                                style: { color: CATEGORY_COLORS[cat.id] || '#8A2BE2' }
                                            })}
                                        </div>
                                        <span className="text-xs font-medium">{cat.label}</span>
                                    </div>
                                    {selectedCategories.includes(cat.id) && <Check className={`w-4 h-4 ${themeConfig.text}`} />}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Payment Method</Label>
                        <div className="flex flex-wrap gap-2">
                            {paymentMethods.map((method) => (
                                <Badge
                                    key={method}
                                    variant="outline"
                                    className={cn(
                                        "px-3 py-1 cursor-pointer transition-colors border-white/10",
                                        selectedPayments.includes(method)
                                            ? `${themeConfig.bgSolid} ${themeConfig.borderSolid} text-white`
                                            : "bg-secondary/10 hover:bg-secondary/20"
                                    )}
                                    onClick={() => {
                                        setSelectedPayments(prev =>
                                            prev.includes(method) ? prev.filter(m => m !== method) : [...prev, method]
                                        );
                                    }}
                                >
                                    {method}
                                </Badge>
                            ))}
                        </div>
                    </div>
                </div>

                <SheetFooter className="p-6 border-t border-white/5 bg-secondary/5 gap-3 sm:flex-col items-stretch">
                    <Button variant="secondary" onClick={onReset} className="h-11 rounded-xl">
                        Reset All
                    </Button>
                    <SheetClose asChild>
                        <Button className={`h-11 rounded-xl shadow-lg ${themeConfig.bgSolid} ${themeConfig.shadowGlow} ${themeConfig.textWhite} ${themeConfig.hoverBg}`}>
                            Apply Filters
                        </Button>
                    </SheetClose>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
