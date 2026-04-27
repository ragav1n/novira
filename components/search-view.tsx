'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    ChevronLeft, Search, SlidersHorizontal, Tag, Plane, Home, Gift,
    Car, Utensils, ShoppingCart, Heart, Gamepad2, School, Laptop, Music,
    X, Check, Calendar as CalendarIcon, Filter, Shirt
} from "lucide-react";
import { CATEGORY_COLORS, getIconForCategory, CATEGORIES as SYSTEM_CATEGORIES } from '@/lib/categories';
import { TransactionRow } from '@/components/transaction-row';
import { Transaction } from '@/types/transaction';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast, ImpactStyle } from '@/utils/haptics';
import { format } from 'date-fns';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useBuckets } from '@/components/providers/buckets-provider';
import { useWorkspaceTheme } from '@/hooks/useWorkspaceTheme';
import { useTransactionInvalidationListener } from '@/hooks/useTransactionInvalidationListener';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetFooter,
    SheetClose
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const categories = SYSTEM_CATEGORIES;

const paymentMethods = ['Cash', 'UPI', 'Debit Card', 'Credit Card', 'Bank Transfer'];

type DateRange = {
    from: Date | undefined;
    to: Date | undefined;
};

type SortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

// Custom hook for debouncing
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

const SearchSkeleton = () => (
    <div>
        {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="relative overflow-hidden rounded-xl mt-1.5 first:mt-0 animate-pulse">
                <div className="flex items-center gap-3 px-4 py-3.5 bg-card" style={{ borderLeft: '3px solid rgba(255,255,255,0.08)' }}>
                    <div className="w-9 h-9 rounded-full bg-secondary/20 shrink-0" />
                    <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <div className="h-[13px] w-2/3 bg-secondary/20 rounded" />
                            <div className="h-[14px] w-14 bg-secondary/20 rounded shrink-0" />
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-[10px] w-16 bg-secondary/15 rounded" />
                            <div className="h-[10px] w-8 bg-secondary/10 rounded" />
                            <div className="h-[10px] w-10 bg-secondary/10 rounded" />
                        </div>
                    </div>
                </div>
            </div>
        ))}
    </div>
);

export function SearchView() {
    const router = useRouter();
    const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const { formatCurrency, convertAmount, currency, activeWorkspaceId, userId } = useUserPreferences();
    const { buckets } = useBuckets();
    const { theme: themeConfig } = useWorkspaceTheme();

    // Debounce search query
    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    // Advanced Filter State
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
    const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
    const [selectedBucketId, setSelectedBucketId] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<SortOption>('date-desc');
    const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

    // Dynamic Max Price calculation
    const [maxPossiblePrice, setMaxPossiblePrice] = useState(1000);

    const getBucketIcon = (iconName?: string) => {
        const icons: Record<string, React.ElementType> = {
            Tag, Plane, Home, Gift, Car, Utensils, ShoppingCart,
            Heart, Gamepad2, School, Laptop, Music
        };
        const Icon = icons[iconName || 'Tag'] || Tag;
        return <Icon className="w-full h-full" />;
    };

    const calculateUserShare = (tx: Transaction, currentUserId: string | null) => {
        if (!currentUserId) return Number(tx.amount);
        if (tx.splits && tx.splits.length > 0) {
            if (tx.user_id === currentUserId) {
                const othersOwe = tx.splits.reduce((sum, s) => sum + Number(s.amount), 0);
                return Number(tx.amount) - othersOwe;
            } else {
                const mySplit = tx.splits.find(s => s.user_id === currentUserId);
                return mySplit ? Number(mySplit.amount) : 0;
            }
        }
        return tx.user_id === currentUserId ? Number(tx.amount) : 0;
    };

    const getBucketChip = (tx: Transaction) => {
        if (!tx.bucket_id) return null;
        const txBucket = buckets.find(b => b.id === tx.bucket_id);
        if (!txBucket) return null;
        return (
            <span className="flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                <div className="w-2.5 h-2.5 shrink-0">{getBucketIcon(txBucket.icon)}</div>
                {txBucket.name}
            </span>
        );
    };

    const fetchAndFilter = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('transactions')
                .select('id, description, amount, category, date, payment_method, created_at, user_id, group_id, currency, exchange_rate, base_currency, is_recurring, is_settlement, exclude_from_allowance, bucket_id, place_name, place_address, place_lat, place_lng, profile:profiles(full_name, avatar_url), splits(user_id, amount, is_paid)');

            // Workspace filter
            if (activeWorkspaceId && activeWorkspaceId !== 'personal') {
                query = query.eq('group_id', activeWorkspaceId);
            } else if (activeWorkspaceId === 'personal') {
                query = query.is('group_id', null);
            }

            // Text search
            if (debouncedSearchQuery) {
                query = query.ilike('description', `%${debouncedSearchQuery}%`);
            }

            // Category filter
            if (selectedCategories.length > 0) {
                query = query.in('category', selectedCategories);
            }

            // Payment method filter
            if (selectedPayments.length > 0) {
                query = query.in('payment_method', selectedPayments);
            }

            // Date range filter
            if (dateRange.from) {
                query = query.gte('date', format(dateRange.from, 'yyyy-MM-dd'));
            }
            if (dateRange.to) {
                query = query.lte('date', format(dateRange.to, 'yyyy-MM-dd'));
            }

            // Price range filter
            if (priceRange[0] > 0) {
                query = query.gte('amount', priceRange[0]);
            }
            if (priceRange[1] < maxPossiblePrice) {
                query = query.lte('amount', priceRange[1]);
            }

            // Bucket filter
            if (selectedBucketId) {
                query = query.eq('bucket_id', selectedBucketId);
            }

            // Sorting
            const ascending = sortBy === 'date-asc' || sortBy === 'amount-asc';
            const sortColumn = sortBy.startsWith('date') ? 'date' : 'amount';
            query = query.order(sortColumn, { ascending });

            const { data } = await query;

            if (data) {
                const formatted = data.map(tx => ({
                    ...tx,
                    profile: Array.isArray(tx.profile) ? tx.profile[0] : tx.profile,
                    splits: tx.splits || []
                })) as Transaction[];
                setFilteredTransactions(formatted);

                // Update max price on first load (no filters active)
                if (!debouncedSearchQuery && selectedCategories.length === 0 && selectedPayments.length === 0 && !dateRange.from && !dateRange.to && !selectedBucketId && priceRange[0] === 0 && priceRange[1] >= maxPossiblePrice) {
                    const max = Math.max(...formatted.map(tx => tx.amount), 1000);
                    const rounded = Math.ceil(max / 100) * 100;
                    if (rounded !== maxPossiblePrice) {
                        setMaxPossiblePrice(rounded);
                        setPriceRange([0, rounded]);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching transactions:', error);
        } finally {
            setLoading(false);
        }
    }, [activeWorkspaceId, debouncedSearchQuery, selectedCategories, selectedPayments, dateRange, priceRange, selectedBucketId, sortBy, maxPossiblePrice]);

    useEffect(() => {
        fetchAndFilter();
    }, [fetchAndFilter]);

    useTransactionInvalidationListener(fetchAndFilter);

    // Realtime subscription — re-fetch when transactions or splits change
    const fetchRef = useRef(fetchAndFilter);
    fetchRef.current = fetchAndFilter;
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!userId) return;

        const txFilter = activeWorkspaceId && activeWorkspaceId !== 'personal'
            ? `group_id=eq.${activeWorkspaceId}`
            : `user_id=eq.${userId}`;

        const debouncedFetch = () => {
            if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
            searchDebounceRef.current = setTimeout(() => fetchRef.current(), 300);
        };

        const channel = supabase
            .channel(`search-sync-${userId}-${activeWorkspaceId || 'personal'}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: txFilter }, debouncedFetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'splits', filter: `user_id=eq.${userId}` }, debouncedFetch)
            .subscribe();

        return () => {
            if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
            supabase.removeChannel(channel);
        };
    }, [userId, activeWorkspaceId]);

    const resetFilters = () => {
        setPriceRange([0, maxPossiblePrice]);
        setSelectedCategories([]);
        setSelectedPayments([]);
        setDateRange({ from: undefined, to: undefined });
        setSelectedBucketId(null);
        setSortBy('date-desc');
        setSearchQuery('');
    };

    const getActiveFilterCount = () => {
        let count = 0;
        if (priceRange[0] > 0 || priceRange[1] < maxPossiblePrice) count++;
        if (selectedCategories.length > 0) count++;
        if (selectedPayments.length > 0) count++;
        if (dateRange.from || dateRange.to) count++;
        if (selectedBucketId) count++;
        return count;
    };

    // Unified icon getter with color support is now handled in return

    const totalFilteredAmount = filteredTransactions.reduce((sum, tx) => sum + convertAmount(Number(tx.amount), tx.currency || 'USD'), 0);

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 220, damping: 28, mass: 0.9 }}
            className="relative min-h-[100dvh] w-full h-full"
        >


            <div className="p-5 space-y-6 max-w-md lg:max-w-4xl mx-auto relative pb-24 lg:pb-8 h-full flex flex-col z-10">
                {/* Header */}
            <div className="flex items-center justify-between relative min-h-[40px]">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-full bg-secondary/30 hover:bg-secondary/50 transition-colors shrink-0 z-10"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <h2 className="text-lg font-semibold truncate px-12">Search & Filter</h2>
                </div>
                <div className="w-9 shrink-0 z-10" />
            </div>

            {/* Search Bar & Filter Toggle */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        id="transaction-search"
                        name="transaction-search"
                        autoComplete="off"
                        placeholder="Search transactions"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            if (e.target.value.length === 0) toast.haptic(ImpactStyle.Light);
                        }}
                        className={`pl-9 bg-secondary/10 border-white/10 h-10 rounded-xl ${themeConfig.ring}`}
                    />
                </div>

                <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
                    <SheetTrigger asChild>
                        <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl bg-secondary/10 border-white/10 relative">
                            <SlidersHorizontal className="w-4 h-4" />
                            {getActiveFilterCount() > 0 && (
                                <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center font-bold text-[11px] ${themeConfig.bgSolid} ${themeConfig.textWhite}`}>
                                    {getActiveFilterCount()}
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
                            {/* Sort Section */}
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

                            {/* Price Range Slider */}
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

                            {/* Date Picker */}
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

                            {/* Buckets Filter */}
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
                                                        {getBucketIcon(bucket.icon)}
                                                    </div>
                                                </div>
                                                <span className="text-[11px] font-medium truncate w-14 text-center">{bucket.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Categories (Multi-select) */}
                            <div className="space-y-3">
                                <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Categories</Label>
                                <div className="grid grid-cols-1 gap-2">
                                    {categories.map((cat) => (
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

                            {/* Payment Methods */}
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
                            <Button variant="secondary" onClick={resetFilters} className="h-11 rounded-xl">
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
            </div>

            {/* Active Filters Summary Chips */}
            {getActiveFilterCount() > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide shrink-0">
                    {dateRange.from && (
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] whitespace-nowrap ${themeConfig.bgMedium} ${themeConfig.borderMedium} ${themeConfig.text}`}>
                            Date Range <X className="w-3 h-3 cursor-pointer" onClick={() => setDateRange({ from: undefined, to: undefined })} />
                        </div>
                    )}
                    {(priceRange[0] > 0 || priceRange[1] < maxPossiblePrice) && (
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] whitespace-nowrap ${themeConfig.bgMedium} ${themeConfig.borderMedium} ${themeConfig.text}`}>
                            Price: {formatCurrency(priceRange[0])}-{formatCurrency(priceRange[1])} <X className="w-3 h-3 cursor-pointer" onClick={() => setPriceRange([0, maxPossiblePrice])} />
                        </div>
                    )}
                    {selectedCategories.map(cat => (
                        <div key={cat} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] whitespace-nowrap capitalize ${themeConfig.bgMedium} ${themeConfig.borderMedium} ${themeConfig.text}`}>
                            {cat} <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedCategories(prev => prev.filter(c => c !== cat))} />
                        </div>
                    ))}
                    {selectedPayments.map(p => (
                        <div key={p} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] whitespace-nowrap ${themeConfig.bgMedium} ${themeConfig.borderMedium} ${themeConfig.text}`}>
                            {p} <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedPayments(prev => prev.filter(m => m !== p))} />
                        </div>
                    ))}
                    {selectedBucketId && buckets.find(b => b.id === selectedBucketId) && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-cyan-500/20 border border-cyan-500/20 rounded-full text-[11px] text-cyan-500 whitespace-nowrap">
                            <div className="w-3 h-3">
                                {getBucketIcon(buckets.find(b => b.id === selectedBucketId)?.icon)}
                            </div>
                            Bucket: {buckets.find(b => b.id === selectedBucketId)?.name} <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedBucketId(null)} />
                        </div>
                    )}
                </div>
            )}

            {/* Total Summary Mini-Card (Visible when filtered) */}
            {getActiveFilterCount() > 0 && (
                <div className={`bg-gradient-to-r to-secondary/20 p-3 rounded-2xl flex justify-between items-center shrink-0 border ${themeConfig.gradient} ${themeConfig.borderLight}`}>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Filtered</span>
                    <span className={`text-lg font-bold ${themeConfig.text}`}>{formatCurrency(totalFilteredAmount)}</span>
                </div>
            )}

            <div className="relative flex-1 min-h-[400px]">


                <div className={cn(
                    "space-y-0 overflow-y-auto pr-1 -mr-1 h-full transition-all duration-300 flex-1",
                    loading ? "opacity-50 blur-[2px] pointer-events-none" : "opacity-100 blur-0"
                )}>
                    {loading ? (
                        <SearchSkeleton />
                    ) : (
                        <AnimatePresence mode="popLayout">
                            {filteredTransactions.length > 0 ? (
                                filteredTransactions.map((tx) => {
                                    const myShare = calculateUserShare(tx, userId);
                                    const showConverted = !!(tx.currency && tx.currency.toUpperCase() !== currency.toUpperCase());
                                    const color = CATEGORY_COLORS[tx.category?.toLowerCase()] || CATEGORY_COLORS.uncategorized;
                                    return (
                                        <TransactionRow
                                            key={tx.id}
                                            tx={tx}
                                            userId={userId}
                                            myShare={myShare}
                                            formattedAmount={formatCurrency(Math.abs(myShare), tx.currency)}
                                            formattedConverted={showConverted ? formatCurrency(convertAmount(Math.abs(myShare), tx.currency || 'USD', currency), currency) : undefined}
                                            showConverted={showConverted}
                                            canEdit={false}
                                            icon={getIconForCategory(tx.category, 'w-4 h-4')}
                                            color={color}
                                            bucketChip={getBucketChip(tx)}
                                            onHistory={() => toast('History is available from the dashboard')}
                                            onEdit={() => {}}
                                            onDelete={() => {}}
                                        />
                                    );
                                })
                        ) : (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-center py-8 text-muted-foreground text-sm"
                            >
                                No transactions found.
                            </motion.div>
                        )}
                    </AnimatePresence>
                    )}
                </div>
            </div>

            {/* Total Footer (Always Visible but simplified) */}
            <div className="pt-4 border-t border-white/5 flex-shrink-0">
                <div className="flex justify-between items-center px-2">
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-widest">{filteredTransactions.length} transactions match</p>
                    <button onClick={resetFilters} className="text-[11px] text-primary font-bold hover:underline">RESET</button>
                </div>
            </div>
            </div>
        </motion.div>
    );
}
