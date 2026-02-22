'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, Search, SlidersHorizontal, Utensils, Car, Zap, ShoppingBag, HeartPulse, Clapperboard, Wallet, Banknote, CreditCard, CircleDollarSign, HelpCircle, Tag, Plane, Home, Gift, ShoppingCart, Stethoscope, Gamepad2, School, Laptop, Music, Heart, RefreshCcw, Shirt } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { format, parseISO, isSameWeek, isSameMonth, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { WaveLoader } from '@/components/ui/wave-loader';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useBuckets } from '@/components/providers/buckets-provider';
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
import { Calendar as CalendarIcon, X, Check, Filter } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type Transaction = {
    id: string;
    description: string;
    amount: number;
    category: string;
    date: string;
    payment_method: string;
    created_at: string;
    currency?: string;
    is_recurring?: boolean;
    bucket_id?: string;
};

const categories = [
    { id: 'food', label: 'Food', icon: Utensils },
    { id: 'groceries', label: 'Groceries', icon: ShoppingCart },
    { id: 'fashion', label: 'Fashion', icon: Shirt },
    { id: 'transport', label: 'Transport', icon: Car },
    { id: 'bills', label: 'Bills', icon: Zap },
    { id: 'shopping', label: 'Shopping', icon: ShoppingBag },
    { id: 'healthcare', label: 'Healthcare', icon: HeartPulse },
    { id: 'entertainment', label: 'Entertainment', icon: Clapperboard },
    { id: 'others', label: 'Others', icon: CircleDollarSign },
    { id: 'uncategorized', label: 'Uncategorized', icon: HelpCircle },
];

const paymentMethods = ['Cash', 'UPI', 'Debit Card', 'Credit Card'];

type DateRange = {
    from: Date | undefined;
    to: Date | undefined;
};

type SortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

export function SearchView() {
    const router = useRouter();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const { formatCurrency, convertAmount, currency } = useUserPreferences();
    const { buckets } = useBuckets();

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

    useEffect(() => {
        fetchTransactions();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [searchQuery, priceRange, selectedCategories, selectedPayments, dateRange, selectedBucketId, sortBy, transactions]);

    const getBucketIcon = (iconName?: string) => {
        const icons: Record<string, any> = {
            Tag, Plane, Home, Gift, Car, Utensils, ShoppingCart,
            Heart, Gamepad2, School, Laptop, Music
        };
        const Icon = icons[iconName || 'Tag'] || Tag;
        return <Icon className="w-full h-full" />;
    };

    const fetchTransactions = async () => {
        try {
            const { data } = await supabase
                .from('transactions')
                .select('*')
                .order('date', { ascending: false });

            if (data) {
                setTransactions(data);
                setFilteredTransactions(data);

                // Set max price based on actual data
                const max = Math.max(...data.map((tx: any) => tx.amount), 1000);
                setMaxPossiblePrice(Math.ceil(max / 100) * 100);
                setPriceRange([0, Math.ceil(max / 100) * 100]);
            }
        } catch (error) {
            console.error('Error fetching transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let result = [...transactions];

        // 1. Text Search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(tx =>
                tx.description.toLowerCase().includes(query) ||
                tx.category.toLowerCase().includes(query)
            );
        }

        // 2. Price Range
        result = result.filter(tx => tx.amount >= priceRange[0] && tx.amount <= priceRange[1]);

        // 3. Categories
        if (selectedCategories.length > 0) {
            result = result.filter(tx => selectedCategories.includes(tx.category.toLowerCase()));
        }

        // 4. Payment Methods
        if (selectedPayments.length > 0) {
            result = result.filter(tx => selectedPayments.includes(tx.payment_method));
        }

        // 5. Date Range
        if (dateRange.from) {
            result = result.filter(tx => isAfter(parseISO(tx.date), startOfDay(dateRange.from!)) || format(parseISO(tx.date), 'yyyy-MM-dd') === format(dateRange.from!, 'yyyy-MM-dd'));
        }
        if (dateRange.to) {
            result = result.filter(tx => isBefore(parseISO(tx.date), endOfDay(dateRange.to!)) || format(parseISO(tx.date), 'yyyy-MM-dd') === format(dateRange.to!, 'yyyy-MM-dd'));
        }

        // 6. Buckets
        if (selectedBucketId) {
            result = result.filter(tx => tx.bucket_id === selectedBucketId);
        }

        // 7. Sorting
        result.sort((a, b) => {
            if (sortBy === 'date-desc') return new Date(b.date).getTime() - new Date(a.date).getTime();
            if (sortBy === 'date-asc') return new Date(a.date).getTime() - new Date(b.date).getTime();
            if (sortBy === 'amount-desc') return b.amount - a.amount;
            if (sortBy === 'amount-asc') return a.amount - b.amount;
            return 0;
        });

        setFilteredTransactions(result);
    };

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

    const getIconForCategory = (category: string) => {
        const cat = categories.find(c => c.id === category.toLowerCase());
        if (cat) return <cat.icon className="w-5 h-5 text-white" />;
        return <CircleDollarSign className="w-5 h-5 text-white" />;
    };

    const totalFilteredAmount = filteredTransactions.reduce((sum, tx) => sum + convertAmount(Number(tx.amount), tx.currency || 'USD'), 0);

    return (
        <div className="p-5 space-y-6 max-w-md mx-auto relative pb-24 h-full flex flex-col">
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
                        placeholder="Search transactions"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-secondary/10 border-white/10 h-10 rounded-xl focus-visible:ring-primary/50"
                    />
                </div>

                <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
                    <SheetTrigger asChild>
                        <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl bg-secondary/10 border-white/10 relative">
                            <SlidersHorizontal className="w-4 h-4" />
                            {getActiveFilterCount() > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-[11px] rounded-full flex items-center justify-center font-bold">
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
                                    <span className="text-xs font-mono text-primary font-bold">
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
                                <Popover>
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
                                                    ? "bg-primary/20 border-primary/50"
                                                    : "bg-secondary/10 border-white/5 hover:border-white/10"
                                            )}
                                            onClick={() => {
                                                setSelectedCategories(prev =>
                                                    prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                                                );
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center">
                                                    <cat.icon className="w-4 h-4 text-white" />
                                                </div>
                                                <span className="text-xs font-medium">{cat.label}</span>
                                            </div>
                                            {selectedCategories.includes(cat.id) && <Check className="w-4 h-4 text-primary" />}
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
                                                    ? "bg-primary border-primary text-white"
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
                                <Button className="h-11 rounded-xl shadow-lg shadow-primary/20">
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
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/20 border border-primary/20 rounded-full text-[11px] text-primary whitespace-nowrap">
                            Date Range <X className="w-3 h-3 cursor-pointer" onClick={() => setDateRange({ from: undefined, to: undefined })} />
                        </div>
                    )}
                    {(priceRange[0] > 0 || priceRange[1] < maxPossiblePrice) && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/20 border border-primary/20 rounded-full text-[11px] text-primary whitespace-nowrap">
                            Price: {formatCurrency(priceRange[0])}-{formatCurrency(priceRange[1])} <X className="w-3 h-3 cursor-pointer" onClick={() => setPriceRange([0, maxPossiblePrice])} />
                        </div>
                    )}
                    {selectedCategories.map(cat => (
                        <div key={cat} className="flex items-center gap-1.5 px-3 py-1 bg-primary/20 border border-primary/20 rounded-full text-[11px] text-primary whitespace-nowrap capitalize">
                            {cat} <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedCategories(prev => prev.filter(c => c !== cat))} />
                        </div>
                    ))}
                    {selectedPayments.map(p => (
                        <div key={p} className="flex items-center gap-1.5 px-3 py-1 bg-primary/20 border border-primary/20 rounded-full text-[11px] text-primary whitespace-nowrap">
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
                <div className="bg-gradient-to-r from-primary/20 to-secondary/20 border border-primary/10 p-3 rounded-2xl flex justify-between items-center shrink-0">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Filtered</span>
                    <span className="text-lg font-bold text-primary">{formatCurrency(totalFilteredAmount)}</span>
                </div>
            )}

            <div className="relative flex-1 min-h-[400px]">
                <AnimatePresence>
                    {loading && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center bg-background/20 backdrop-blur-[2px]"
                            style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'rgba(12, 8, 30, 0.2)',
                                backdropFilter: 'blur(2px)',
                                zIndex: 50
                            }}
                        >
                            <WaveLoader bars={5} message="Loading transactions..." />
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className={cn(
                    "space-y-3 overflow-y-auto pr-1 -mr-1 h-full transition-all duration-300",
                    loading ? "opacity-40 blur-[1px] pointer-events-none" : "opacity-100 blur-0"
                )}>
                    <AnimatePresence mode="popLayout">
                        {filteredTransactions.length > 0 ? (
                            filteredTransactions.map((tx) => (
                                <motion.div
                                    key={tx.id}
                                    layout
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                                    className="flex items-center justify-between p-3 rounded-2xl bg-card/20 border border-white/5 hover:bg-card/40 transition-colors"
                                >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center border border-white/5 shrink-0">
                                            {getIconForCategory(tx.category)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-medium text-sm truncate">{tx.description}</p>
                                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                                                <span className="px-1.5 py-0.5 rounded bg-primary/10 text-[11px] text-primary border border-primary/10 capitalize shrink-0">{tx.category}</span>
                                                <span className="shrink-0">• {tx.payment_method}</span>
                                                <span className="shrink-0">• {format(parseISO(tx.date), 'MMM d')}</span>
                                            </div>

                                            {(tx.bucket_id || tx.is_recurring) && (
                                                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                                    {tx.bucket_id && buckets.find(b => b.id === tx.bucket_id) && (
                                                        <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-[11px] text-cyan-500 border border-cyan-500/10 font-bold flex items-center gap-1 shrink-0">
                                                            <div className="w-2.5 h-2.5">
                                                                {getBucketIcon(buckets.find(b => b.id === tx.bucket_id)?.icon)}
                                                            </div>
                                                            {buckets.find(b => b.id === tx.bucket_id)?.name}
                                                        </span>
                                                    )}
                                                    {tx.is_recurring && (
                                                        <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-[11px] text-sky-500 border border-sky-500/10 font-bold flex items-center gap-1 shrink-0">
                                                            <RefreshCcw className="w-2.5 h-2.5" />
                                                            Recurring
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end shrink-0 ml-2">
                                        <span className="font-bold text-sm whitespace-nowrap">
                                            -{formatCurrency(Number(tx.amount), tx.currency)}
                                        </span>
                                        {tx.currency && tx.currency !== currency && (
                                            <div className="text-[10px] text-emerald-500 font-bold leading-none bg-emerald-500/5 px-1 rounded-sm mt-1">
                                                ≈ {formatCurrency(convertAmount(Number(tx.amount), tx.currency), currency)}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            !loading && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-center py-8 text-muted-foreground text-sm"
                                >
                                    No transactions found.
                                </motion.div>
                            )
                        )}
                    </AnimatePresence>
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
    );
}
