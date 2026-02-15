'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, Search, SlidersHorizontal, Utensils, Car, Zap, ShoppingBag, HeartPulse, Clapperboard, Wallet, Banknote, CreditCard, CircleDollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { format, parseISO, isSameWeek, isSameMonth, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { WaveLoader } from '@/components/ui/wave-loader';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
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
};

const categories = [
    { id: 'food', label: 'Food', icon: Utensils },
    { id: 'transport', label: 'Transport', icon: Car },
    { id: 'bills', label: 'Bills', icon: Zap },
    { id: 'shopping', label: 'Shopping', icon: ShoppingBag },
    { id: 'healthcare', label: 'Healthcare', icon: HeartPulse },
    { id: 'entertainment', label: 'Entertainment', icon: Clapperboard },
    { id: 'others', label: 'Others', icon: CircleDollarSign },
];

const paymentMethods = ['Cash', 'Debit Card', 'Credit Card'];

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

    // Advanced Filter State
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
    const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
    const [sortBy, setSortBy] = useState<SortOption>('date-desc');
    const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

    // Dynamic Max Price calculation
    const [maxPossiblePrice, setMaxPossiblePrice] = useState(1000);

    useEffect(() => {
        fetchTransactions();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [searchQuery, priceRange, selectedCategories, selectedPayments, dateRange, sortBy, transactions]);

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

        // 6. Sorting
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
        setSortBy('date-desc');
        setSearchQuery('');
    };

    const getActiveFilterCount = () => {
        let count = 0;
        if (priceRange[0] > 0 || priceRange[1] < maxPossiblePrice) count++;
        if (selectedCategories.length > 0) count++;
        if (selectedPayments.length > 0) count++;
        if (dateRange.from || dateRange.to) count++;
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
            <div className="flex items-center justify-between">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-full bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-lg font-semibold">Search & Filter</h2>
                <div className="w-9" />
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
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-[10px] rounded-full flex items-center justify-center font-bold">
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
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/20 border border-primary/20 rounded-full text-[10px] text-primary whitespace-nowrap">
                            Date Range <X className="w-3 h-3 cursor-pointer" onClick={() => setDateRange({ from: undefined, to: undefined })} />
                        </div>
                    )}
                    {(priceRange[0] > 0 || priceRange[1] < maxPossiblePrice) && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/20 border border-primary/20 rounded-full text-[10px] text-primary whitespace-nowrap">
                            Price: {formatCurrency(priceRange[0])}-{formatCurrency(priceRange[1])} <X className="w-3 h-3 cursor-pointer" onClick={() => setPriceRange([0, maxPossiblePrice])} />
                        </div>
                    )}
                    {selectedCategories.map(cat => (
                        <div key={cat} className="flex items-center gap-1.5 px-3 py-1 bg-primary/20 border border-primary/20 rounded-full text-[10px] text-primary whitespace-nowrap capitalize">
                            {cat} <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedCategories(prev => prev.filter(c => c !== cat))} />
                        </div>
                    ))}
                    {selectedPayments.map(p => (
                        <div key={p} className="flex items-center gap-1.5 px-3 py-1 bg-primary/20 border border-primary/20 rounded-full text-[10px] text-primary whitespace-nowrap">
                            {p} <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedPayments(prev => prev.filter(m => m !== p))} />
                        </div>
                    ))}
                </div>
            )}

            {/* Total Summary Mini-Card (Visible when filtered) */}
            {getActiveFilterCount() > 0 && (
                <div className="bg-gradient-to-r from-primary/20 to-secondary/20 border border-primary/10 p-3 rounded-2xl flex justify-between items-center shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Filtered</span>
                    <span className="text-lg font-bold text-primary">{formatCurrency(totalFilteredAmount)}</span>
                </div>
            )}

            <div className="space-y-3 overflow-y-auto pr-1 -mr-1 flex-1">
                {loading ? (
                    <div className="h-full w-full flex flex-col items-center justify-center min-h-[200px]">
                        <WaveLoader bars={5} message="Loading..." />
                    </div>
                ) : (
                    <div className="space-y-3">
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
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center border border-white/5">
                                                {getIconForCategory(tx.category)}
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">{tx.description}</p>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                    <span className="px-1.5 py-0.5 rounded bg-primary/10 text-[10px] text-primary border border-primary/10 capitalize">{tx.category}</span>
                                                    <span>• {tx.payment_method}</span>
                                                    <span>• {format(parseISO(tx.date), 'MMM d')}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <span className="font-bold text-sm">-{formatCurrency(Number(tx.amount), tx.currency)}</span>
                                    </motion.div>
                                ))
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
                    </div>
                )}
            </div>

            {/* Total Footer (Always Visible but simplified) */}
            <div className="pt-4 border-t border-white/5 flex-shrink-0">
                <div className="flex justify-between items-center px-2">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">{filteredTransactions.length} transactions match</p>
                    <button onClick={resetFilters} className="text-[10px] text-primary font-bold hover:underline">RESET</button>
                </div>
            </div>
        </div>
    );
}
