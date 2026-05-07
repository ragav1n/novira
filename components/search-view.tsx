'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    ChevronLeft, Search, SlidersHorizontal, Tag, Plane, Home, Gift,
    Car, Utensils, ShoppingCart, Heart, Gamepad2, School, Laptop, Music,
    X, Check, Calendar as CalendarIcon, Filter, Shirt, CheckSquare, Square, Trash2,
    Bookmark, BookmarkPlus, RefreshCcw, Ban, SearchX
} from "lucide-react";
import { CATEGORY_COLORS, getIconForCategory, getCategoryLabel, CATEGORIES as SYSTEM_CATEGORIES } from '@/lib/categories';
import { TransactionRow } from '@/components/transaction-row';
import { Transaction } from '@/types/transaction';
import { enqueueMutation } from '@/lib/sync-manager';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast, ImpactStyle } from '@/utils/haptics';
import { format, parseISO, startOfDay, endOfDay, subDays, startOfMonth, isSameDay } from 'date-fns';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useBucketsList } from '@/components/providers/buckets-provider';
import { useWorkspaceTheme } from '@/hooks/useWorkspaceTheme';
import { useTransactionInvalidationListener } from '@/hooks/useTransactionInvalidationListener';
import { loadPresets, savePreset, deletePreset, type SearchPreset, type SearchFilterSnapshot } from '@/lib/search-presets';
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

type QuickRangeId = 'today' | '7d' | '30d' | 'month';
type NumericOp = '>' | '<' | '>=' | '<=' | '=';

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

function parseNumericQuery(q: string): { op: NumericOp; value: number } | null {
    const m = /^(>=|<=|>|<|=)\s*(\d+(?:\.\d+)?)$/.exec(q.trim());
    if (!m) return null;
    const value = Number(m[2]);
    if (!Number.isFinite(value)) return null;
    return { op: m[1] as NumericOp, value };
}

function highlightMatch(text: string | null | undefined, query: string): React.ReactNode {
    if (!text) return text;
    const trimmed = query.trim();
    if (!trimmed) return text;
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const splitter = new RegExp(`(${escaped})`, 'gi');
    const matcher = new RegExp(`^${escaped}$`, 'i');
    const parts = text.split(splitter);
    return parts.map((part, i) =>
        matcher.test(part)
            ? <mark key={i} className="bg-primary/25 text-primary rounded px-0.5">{part}</mark>
            : <React.Fragment key={i}>{part}</React.Fragment>
    );
}

function rangeMatches(from: Date | undefined, to: Date | undefined, target: { from: Date; to: Date }): boolean {
    if (!from || !to) return false;
    return isSameDay(from, target.from) && isSameDay(to, target.to);
}

function getQuickRange(id: QuickRangeId): { from: Date; to: Date } {
    const now = new Date();
    switch (id) {
        case 'today':
            return { from: startOfDay(now), to: endOfDay(now) };
        case '7d':
            return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
        case '30d':
            return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
        case 'month':
            return { from: startOfMonth(now), to: endOfDay(now) };
    }
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
    const searchParams = useSearchParams();
    const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
    const [searchQuery, setSearchQuery] = useState(() => searchParams?.get('q') || '');
    const [loading, setLoading] = useState(true);
    const { formatCurrency, convertAmount, currency, activeWorkspaceId, userId } = useUserPreferences();
    const { buckets } = useBucketsList();
    const { theme: themeConfig } = useWorkspaceTheme();
    // Bumped on each workspace/user change so in-flight fetches from a previous
    // workspace can't land their results on top of the new one.
    const fetchGenRef = useRef(0);

    // Debounce search query
    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    // Advanced Filter State
    const [priceRange, setPriceRange] = useState<[number, number]>(() => {
        const min = Number(searchParams?.get('min'));
        const max = Number(searchParams?.get('max'));
        return [Number.isFinite(min) && min > 0 ? min : 0, Number.isFinite(max) && max > 0 ? max : 1000];
    });
    const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
        const c = searchParams?.get('category');
        return c ? c.split(',').filter(Boolean) : [];
    });
    const [selectedPayments, setSelectedPayments] = useState<string[]>(() => {
        const p = searchParams?.get('payment');
        return p ? p.split(',').filter(Boolean) : [];
    });
    const [dateRange, setDateRange] = useState<DateRange>(() => {
        const from = searchParams?.get('from');
        const to = searchParams?.get('to');
        return {
            from: from ? new Date(from + 'T00:00:00') : undefined,
            to: to ? new Date(to + 'T00:00:00') : undefined,
        };
    });
    const [selectedBucketId, setSelectedBucketId] = useState<string | null>(() => searchParams?.get('bucket') || null);
    const [selectedTags, setSelectedTags] = useState<string[]>(() => {
        const t = searchParams?.get('tag');
        return t ? t.split(',').filter(Boolean) : [];
    });
    const [knownTags, setKnownTags] = useState<string[]>([]);
    const [sortBy, setSortBy] = useState<SortOption>(() => {
        const s = searchParams?.get('sort');
        if (s === 'date-asc' || s === 'amount-desc' || s === 'amount-asc' || s === 'date-desc') return s;
        return 'date-desc';
    });
    const [showRecurringOnly, setShowRecurringOnly] = useState<boolean>(() => searchParams?.get('recurring') === '1');
    const [showExcludedOnly, setShowExcludedOnly] = useState<boolean>(() => searchParams?.get('excluded') === '1');
    const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

    // Presets
    const [presets, setPresets] = useState<SearchPreset[]>([]);
    const [presetNameDraft, setPresetNameDraft] = useState('');
    const [showPresetInput, setShowPresetInput] = useState(false);

    // Bulk-edit mode state
    const [bulkMode, setBulkMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isRecategorizeOpen, setIsRecategorizeOpen] = useState(false);

    const exitBulkMode = useCallback(() => {
        setBulkMode(false);
        setSelectedIds(new Set());
    }, []);

    const toggleSelection = useCallback((id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);

    const bulkDelete = useCallback(async () => {
        if (selectedIds.size === 0) return;
        const ids = [...selectedIds];
        try {
            await Promise.all(ids.map(id => enqueueMutation('DELETE_TRANSACTION', { id })));
            toast.success(`Deleted ${ids.length} transaction${ids.length === 1 ? '' : 's'}`);
            setFilteredTransactions(prev => prev.filter(t => !selectedIds.has(t.id)));
            exitBulkMode();
        } catch (error) {
            console.error('Bulk delete failed:', error);
            toast.error('Failed to delete some transactions');
        }
    }, [selectedIds, exitBulkMode]);

    const bulkRecategorize = useCallback(async (categoryId: string) => {
        if (selectedIds.size === 0) return;
        const ids = [...selectedIds];
        try {
            await Promise.all(ids.map(id => enqueueMutation('UPDATE_TRANSACTION', { id, patch: { category: categoryId } })));
            toast.success(`Recategorized ${ids.length} transaction${ids.length === 1 ? '' : 's'}`);
            setFilteredTransactions(prev => prev.map(t => selectedIds.has(t.id) ? { ...t, category: categoryId } : t));
            setIsRecategorizeOpen(false);
            exitBulkMode();
        } catch (error) {
            console.error('Bulk recategorize failed:', error);
            toast.error('Failed to recategorize some transactions');
        }
    }, [selectedIds, exitBulkMode]);

    // Dynamic Max Price calculation. Seed with the URL's `max` if it's higher
    // than the default ceiling so a shared link with a custom range doesn't get
    // clobbered by the auto-recalc the first time data lands.
    const [maxPossiblePrice, setMaxPossiblePrice] = useState(() => {
        const m = Number(searchParams?.get('max'));
        return Math.max(1000, Number.isFinite(m) ? m : 0);
    });

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
        const myGen = fetchGenRef.current;
        setLoading(true);
        try {
            let query = supabase
                .from('transactions')
                .select('id, description, amount, category, date, payment_method, created_at, user_id, group_id, currency, exchange_rate, base_currency, is_recurring, is_settlement, exclude_from_allowance, bucket_id, place_name, place_address, place_lat, place_lng, tags, notes, profile:profiles(full_name, avatar_url), splits(user_id, amount, is_paid)');

            // Workspace filter
            if (activeWorkspaceId && activeWorkspaceId !== 'personal') {
                query = query.eq('group_id', activeWorkspaceId);
            } else if (activeWorkspaceId === 'personal') {
                query = query.is('group_id', null);
            }

            // Numeric shortcut: a leading operator (>, <, >=, <=, =) + number is
            // applied as an amount filter instead of a text search.
            const numeric = parseNumericQuery(debouncedSearchQuery);
            if (numeric) {
                if (numeric.op === '>') query = query.gt('amount', numeric.value);
                else if (numeric.op === '<') query = query.lt('amount', numeric.value);
                else if (numeric.op === '>=') query = query.gte('amount', numeric.value);
                else if (numeric.op === '<=') query = query.lte('amount', numeric.value);
                else query = query.eq('amount', numeric.value);
            } else if (debouncedSearchQuery) {
                // Text search across description, place name, place address, and notes.
                // Wrap in double quotes so commas/periods in the user's query don't
                // break PostgREST's `or` filter parser; escape ilike wildcards so a
                // literal `%` or `_` in the query doesn't act as a pattern char.
                const escaped = debouncedSearchQuery
                    .replace(/[%_\\]/g, '\\$&')
                    .replace(/"/g, '');
                query = query.or(
                    `description.ilike."%${escaped}%",place_name.ilike."%${escaped}%",place_address.ilike."%${escaped}%",notes.ilike."%${escaped}%"`
                );
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

            // Tag filter — match transactions that contain ALL selected tags.
            if (selectedTags.length > 0) {
                query = query.contains('tags', selectedTags);
            }

            // Recurring / excluded toggles
            if (showRecurringOnly) {
                query = query.eq('is_recurring', true);
            }
            if (showExcludedOnly) {
                query = query.eq('exclude_from_allowance', true);
            }

            // Sorting
            const ascending = sortBy === 'date-asc' || sortBy === 'amount-asc';
            const sortColumn = sortBy.startsWith('date') ? 'date' : 'amount';
            query = query.order(sortColumn, { ascending });

            const { data } = await query;

            if (fetchGenRef.current !== myGen) return;
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
            if (fetchGenRef.current === myGen) setLoading(false);
        }
    }, [activeWorkspaceId, debouncedSearchQuery, selectedCategories, selectedPayments, dateRange, priceRange, selectedBucketId, selectedTags, sortBy, maxPossiblePrice, showRecurringOnly, showExcludedOnly]);

    useEffect(() => {
        fetchGenRef.current++;
        fetchAndFilter();
    }, [fetchAndFilter]);

    // Build the user's tag vocabulary once so the filter sheet has chips to choose from.
    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        (async () => {
            try {
                const { data } = await supabase
                    .from('transactions')
                    .select('tags')
                    .eq('user_id', userId)
                    .not('tags', 'is', null)
                    .order('created_at', { ascending: false })
                    .limit(300);
                if (cancelled || !data) return;
                const counts = new Map<string, number>();
                for (const row of data as { tags: string[] | null }[]) {
                    for (const t of row.tags || []) {
                        if (!t) continue;
                        counts.set(t, (counts.get(t) || 0) + 1);
                    }
                }
                setKnownTags([...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t));
            } catch (error) {
                console.error('Error fetching tag vocabulary:', error);
            }
        })();
        return () => { cancelled = true; };
    }, [userId]);

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

    // Load user-saved presets
    useEffect(() => {
        if (!userId) return;
        setPresets(loadPresets(userId));
    }, [userId]);

    // Persist filter state to URL so refresh / back-nav / shared links work.
    // Debounced via the searchParams.toString comparison + replace which is cheap.
    const urlWriteRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        const params = new URLSearchParams();
        if (debouncedSearchQuery) params.set('q', debouncedSearchQuery);
        if (selectedCategories.length > 0) params.set('category', selectedCategories.join(','));
        if (selectedPayments.length > 0) params.set('payment', selectedPayments.join(','));
        if (selectedTags.length > 0) params.set('tag', selectedTags.join(','));
        if (dateRange.from) params.set('from', format(dateRange.from, 'yyyy-MM-dd'));
        if (dateRange.to) params.set('to', format(dateRange.to, 'yyyy-MM-dd'));
        if (priceRange[0] > 0) params.set('min', String(priceRange[0]));
        if (priceRange[1] < maxPossiblePrice) params.set('max', String(priceRange[1]));
        if (selectedBucketId) params.set('bucket', selectedBucketId);
        if (sortBy !== 'date-desc') params.set('sort', sortBy);
        if (showRecurringOnly) params.set('recurring', '1');
        if (showExcludedOnly) params.set('excluded', '1');

        const next = params.toString();
        if (urlWriteRef.current) clearTimeout(urlWriteRef.current);
        urlWriteRef.current = setTimeout(() => {
            const current = window.location.search.replace(/^\?/, '');
            if (current === next) return;
            const url = next ? `${window.location.pathname}?${next}` : window.location.pathname;
            router.replace(url, { scroll: false });
        }, 150);
        return () => {
            if (urlWriteRef.current) clearTimeout(urlWriteRef.current);
        };
    }, [debouncedSearchQuery, selectedCategories, selectedPayments, selectedTags, dateRange, priceRange, maxPossiblePrice, selectedBucketId, sortBy, showRecurringOnly, showExcludedOnly, router]);

    const resetFilters = () => {
        setPriceRange([0, maxPossiblePrice]);
        setSelectedCategories([]);
        setSelectedPayments([]);
        setDateRange({ from: undefined, to: undefined });
        setSelectedBucketId(null);
        setSelectedTags([]);
        setSortBy('date-desc');
        setSearchQuery('');
        setShowRecurringOnly(false);
        setShowExcludedOnly(false);
    };

    const getActiveFilterCount = () => {
        let count = 0;
        if (priceRange[0] > 0 || priceRange[1] < maxPossiblePrice) count++;
        if (selectedCategories.length > 0) count++;
        if (selectedPayments.length > 0) count++;
        if (dateRange.from || dateRange.to) count++;
        if (selectedBucketId) count++;
        if (selectedTags.length > 0) count++;
        if (showRecurringOnly) count++;
        if (showExcludedOnly) count++;
        return count;
    };

    const buildSnapshot = useCallback((): SearchFilterSnapshot => ({
        q: searchQuery || undefined,
        categories: selectedCategories.length ? selectedCategories : undefined,
        payments: selectedPayments.length ? selectedPayments : undefined,
        from: dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined,
        to: dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined,
        min: priceRange[0] > 0 ? priceRange[0] : undefined,
        max: priceRange[1] < maxPossiblePrice ? priceRange[1] : undefined,
        bucket: selectedBucketId || undefined,
        tags: selectedTags.length ? selectedTags : undefined,
        sort: sortBy !== 'date-desc' ? sortBy : undefined,
        recurring: showRecurringOnly || undefined,
        excluded: showExcludedOnly || undefined,
    }), [searchQuery, selectedCategories, selectedPayments, dateRange, priceRange, maxPossiblePrice, selectedBucketId, selectedTags, sortBy, showRecurringOnly, showExcludedOnly]);

    const applySnapshot = useCallback((snap: SearchFilterSnapshot) => {
        setSearchQuery(snap.q || '');
        setSelectedCategories(snap.categories || []);
        setSelectedPayments(snap.payments || []);
        setSelectedTags(snap.tags || []);
        setDateRange({
            from: snap.from ? new Date(snap.from + 'T00:00:00') : undefined,
            to: snap.to ? new Date(snap.to + 'T00:00:00') : undefined,
        });
        setPriceRange([snap.min ?? 0, snap.max ?? maxPossiblePrice]);
        setSelectedBucketId(snap.bucket ?? null);
        setSortBy((snap.sort as SortOption) || 'date-desc');
        setShowRecurringOnly(!!snap.recurring);
        setShowExcludedOnly(!!snap.excluded);
    }, [maxPossiblePrice]);

    const handleSavePreset = useCallback(() => {
        if (!userId) return;
        const name = presetNameDraft.trim();
        if (!name) return;
        const created = savePreset(userId, name, buildSnapshot());
        setPresets(loadPresets(userId));
        setPresetNameDraft('');
        setShowPresetInput(false);
        toast.success(`Saved preset "${created.name}"`);
    }, [userId, presetNameDraft, buildSnapshot]);

    const handleDeletePreset = useCallback((id: string) => {
        if (!userId) return;
        deletePreset(userId, id);
        setPresets(loadPresets(userId));
    }, [userId]);

    // Toggle a quick date range. Tapping the active chip clears it.
    const toggleQuickRange = useCallback((id: QuickRangeId) => {
        const target = getQuickRange(id);
        if (rangeMatches(dateRange.from, dateRange.to, target)) {
            setDateRange({ from: undefined, to: undefined });
        } else {
            setDateRange({ from: target.from, to: target.to });
        }
    }, [dateRange.from, dateRange.to]);

    const activeQuickRange = useMemo<QuickRangeId | null>(() => {
        if (!dateRange.from || !dateRange.to) return null;
        const ids: QuickRangeId[] = ['today', '7d', '30d', 'month'];
        for (const id of ids) {
            if (rangeMatches(dateRange.from, dateRange.to, getQuickRange(id))) return id;
        }
        return null;
    }, [dateRange.from, dateRange.to]);

    const numericQueryActive = useMemo(() => parseNumericQuery(debouncedSearchQuery), [debouncedSearchQuery]);

    // Stats derived from the current filtered set
    const filterStats = useMemo(() => {
        if (filteredTransactions.length === 0) return null;
        let total = 0;
        const byCategory = new Map<string, number>();
        for (const tx of filteredTransactions) {
            const amt = convertAmount(Number(tx.amount), tx.currency || 'USD');
            total += amt;
            const cat = (tx.category || 'uncategorized').toLowerCase();
            byCategory.set(cat, (byCategory.get(cat) || 0) + amt);
        }
        let topCategory: string | null = null;
        let topAmount = -Infinity;
        for (const [cat, amt] of byCategory) {
            if (amt > topAmount) { topAmount = amt; topCategory = cat; }
        }
        return {
            total,
            count: filteredTransactions.length,
            avg: total / filteredTransactions.length,
            topCategory,
        };
    }, [filteredTransactions, convertAmount]);

    // Unified icon getter with color support is now handled in return

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
                        className={`pl-9 pr-9 bg-secondary/10 border-white/10 h-10 rounded-xl ${themeConfig.ring}`}
                    />
                    {(searchQuery !== debouncedSearchQuery || (loading && !!searchQuery)) && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" aria-hidden="true" />
                    )}
                </div>

                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => bulkMode ? exitBulkMode() : setBulkMode(true)}
                    className={cn(
                        "h-10 w-10 shrink-0 rounded-xl bg-secondary/10 border-white/10",
                        bulkMode && `${themeConfig.bgMedium} ${themeConfig.borderMedium} ${themeConfig.text}`
                    )}
                    aria-label={bulkMode ? 'Exit selection mode' : 'Enter selection mode'}
                    title={bulkMode ? 'Exit selection mode' : 'Select multiple'}
                >
                    <CheckSquare className="w-4 h-4" />
                </Button>

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

                            {/* Tags Filter */}
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

            {/* Quick filter chips */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide shrink-0 -mt-2">
                {([
                    { id: 'today' as const, label: 'Today' },
                    { id: '7d' as const, label: '7d' },
                    { id: '30d' as const, label: '30d' },
                    { id: 'month' as const, label: 'This month' },
                ]).map(({ id, label }) => {
                    const active = activeQuickRange === id;
                    return (
                        <button
                            key={id}
                            type="button"
                            onClick={() => toggleQuickRange(id)}
                            className={cn(
                                'shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors',
                                active
                                    ? `${themeConfig.bgMedium} ${themeConfig.borderMedium} ${themeConfig.text}`
                                    : 'bg-secondary/10 border-white/10 text-muted-foreground hover:border-white/20'
                            )}
                        >
                            {label}
                        </button>
                    );
                })}
                <button
                    type="button"
                    onClick={() => setShowRecurringOnly(v => !v)}
                    className={cn(
                        'shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors',
                        showRecurringOnly
                            ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                            : 'bg-secondary/10 border-white/10 text-muted-foreground hover:border-white/20'
                    )}
                >
                    <RefreshCcw className="w-3 h-3" />
                    Recurring
                </button>
                <button
                    type="button"
                    onClick={() => setShowExcludedOnly(v => !v)}
                    className={cn(
                        'shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors',
                        showExcludedOnly
                            ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                            : 'bg-secondary/10 border-white/10 text-muted-foreground hover:border-white/20'
                    )}
                >
                    <Ban className="w-3 h-3" />
                    Excluded
                </button>
            </div>

            {/* Numeric query hint */}
            {numericQueryActive && (
                <div className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-[11px] shrink-0 ${themeConfig.bgMedium} ${themeConfig.borderMedium} border`}>
                    <span className={`${themeConfig.text} font-semibold`}>
                        Filtering by amount {numericQueryActive.op} {formatCurrency(numericQueryActive.value)}
                    </span>
                    <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Clear amount filter"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* Saved presets row */}
            {presets.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide shrink-0">
                    {presets.map((p) => (
                        <div key={p.id} className="shrink-0 inline-flex items-center gap-1 pl-3 pr-1.5 py-1 rounded-full text-[11px] font-semibold bg-secondary/15 border border-white/10 text-foreground/80">
                            <button type="button" onClick={() => applySnapshot(p.filters)} className="inline-flex items-center gap-1.5">
                                <Bookmark className="w-3 h-3" />
                                {p.name}
                            </button>
                            <button
                                type="button"
                                onClick={() => handleDeletePreset(p.id)}
                                className="ml-1 p-0.5 rounded-full hover:bg-white/10 text-muted-foreground"
                                aria-label={`Delete preset ${p.name}`}
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Save preset control (only when there are filters to save) */}
            {getActiveFilterCount() > 0 && (
                <div className="flex items-center gap-2 shrink-0">
                    {showPresetInput ? (
                        <>
                            <Input
                                autoFocus
                                placeholder="Preset name"
                                value={presetNameDraft}
                                onChange={(e) => setPresetNameDraft(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSavePreset();
                                    if (e.key === 'Escape') { setShowPresetInput(false); setPresetNameDraft(''); }
                                }}
                                className="h-8 text-xs bg-secondary/10 border-white/10 rounded-lg flex-1"
                            />
                            <Button
                                size="sm"
                                onClick={handleSavePreset}
                                disabled={!presetNameDraft.trim()}
                                className={`h-8 text-[11px] rounded-lg ${themeConfig.bgSolid} ${themeConfig.textWhite}`}
                            >
                                Save
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => { setShowPresetInput(false); setPresetNameDraft(''); }}
                                className="h-8 text-[11px] rounded-lg"
                            >
                                Cancel
                            </Button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setShowPresetInput(true)}
                            className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <BookmarkPlus className="w-3.5 h-3.5" />
                            Save filter as preset
                        </button>
                    )}
                </div>
            )}

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
                    {selectedTags.map(t => (
                        <div key={t} className="flex items-center gap-1.5 px-3 py-1 bg-primary/15 border border-primary/30 rounded-full text-[11px] text-primary whitespace-nowrap">
                            #{t} <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedTags(prev => prev.filter(x => x !== t))} />
                        </div>
                    ))}
                    {showRecurringOnly && (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] whitespace-nowrap bg-cyan-500/15 border border-cyan-500/40 text-cyan-300">
                            Recurring <X className="w-3 h-3 cursor-pointer" onClick={() => setShowRecurringOnly(false)} />
                        </div>
                    )}
                    {showExcludedOnly && (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] whitespace-nowrap bg-rose-500/15 border border-rose-500/40 text-rose-300">
                            Excluded <X className="w-3 h-3 cursor-pointer" onClick={() => setShowExcludedOnly(false)} />
                        </div>
                    )}
                </div>
            )}

            {/* Filter Stats Card (Visible when filtered) */}
            {getActiveFilterCount() > 0 && filterStats && (
                <div className={`bg-gradient-to-r to-secondary/20 p-3 rounded-2xl shrink-0 border ${themeConfig.gradient} ${themeConfig.borderLight}`}>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total</span>
                            <span className={`text-base font-bold ${themeConfig.text} tabular-nums`}>{formatCurrency(filterStats.total)}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Count</span>
                            <span className={`text-base font-bold ${themeConfig.text} tabular-nums`}>{filterStats.count}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Avg</span>
                            <span className={`text-base font-bold ${themeConfig.text} tabular-nums`}>{formatCurrency(filterStats.avg)}</span>
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Top Category</span>
                            {filterStats.topCategory ? (
                                <span
                                    className="inline-flex items-center gap-1.5 mt-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-bold capitalize self-start max-w-full truncate"
                                    style={{
                                        backgroundColor: `${CATEGORY_COLORS[filterStats.topCategory] || '#8A2BE2'}20`,
                                        color: CATEGORY_COLORS[filterStats.topCategory] || '#8A2BE2',
                                    }}
                                >
                                    <span className="w-3 h-3 shrink-0">
                                        {React.cloneElement(getIconForCategory(filterStats.topCategory, 'w-3 h-3') as React.ReactElement<{ style?: React.CSSProperties }>, {
                                            style: { color: CATEGORY_COLORS[filterStats.topCategory] || '#8A2BE2' },
                                        })}
                                    </span>
                                    <span className="truncate">{getCategoryLabel(filterStats.topCategory)}</span>
                                </span>
                            ) : (
                                <span className="text-base font-bold text-muted-foreground">—</span>
                            )}
                        </div>
                    </div>
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
                                (() => {
                                    const groupByDate = sortBy.startsWith('date');
                                    const nodes: React.ReactNode[] = [];
                                    let lastDateKey: string | null = null;
                                    const queryActive = !!debouncedSearchQuery && !numericQueryActive;
                                    for (const tx of filteredTransactions) {
                                        const dateKey = (tx.date || '').slice(0, 10);
                                        if (groupByDate && dateKey && dateKey !== lastDateKey) {
                                            lastDateKey = dateKey;
                                            nodes.push(
                                                <div
                                                    key={`hdr-${dateKey}`}
                                                    className="sticky top-0 z-10 bg-background/85 backdrop-blur px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                                                >
                                                    {format(parseISO(dateKey), 'EEE, MMM d')}
                                                </div>
                                            );
                                        }
                                        const myShare = calculateUserShare(tx, userId);
                                        const showConverted = !!(tx.currency && tx.currency.toUpperCase() !== currency.toUpperCase());
                                        const color = CATEGORY_COLORS[tx.category?.toLowerCase()] || CATEGORY_COLORS.uncategorized;
                                        const isSelected = selectedIds.has(tx.id);
                                        const descriptionNode = queryActive
                                            ? highlightMatch(tx.description, debouncedSearchQuery)
                                            : undefined;
                                        const row = (
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
                                                descriptionNode={descriptionNode}
                                                onHistory={() => toast('History is available from the dashboard')}
                                                onEdit={() => {}}
                                                onDelete={() => {}}
                                            />
                                        );
                                        if (!bulkMode) {
                                            nodes.push(row);
                                        } else {
                                            nodes.push(
                                                <div
                                                    key={tx.id}
                                                    onClick={() => toggleSelection(tx.id)}
                                                    className={cn(
                                                        "relative flex items-center gap-2 cursor-pointer rounded-xl transition-colors",
                                                        isSelected && `${themeConfig.bgMedium}`
                                                    )}
                                                >
                                                    <div className="pl-2 shrink-0">
                                                        {isSelected
                                                            ? <CheckSquare className={cn("w-5 h-5", themeConfig.text)} />
                                                            : <Square className="w-5 h-5 text-muted-foreground" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0 pointer-events-none">
                                                        {row}
                                                    </div>
                                                </div>
                                            );
                                        }
                                    }
                                    return nodes;
                                })()
                        ) : (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col items-center justify-center py-12 px-6 text-center"
                            >
                                <div className="w-14 h-14 rounded-2xl bg-secondary/20 border border-white/5 flex items-center justify-center mb-3">
                                    <SearchX className="w-6 h-6 text-muted-foreground/50" strokeWidth={1.75} />
                                </div>
                                <p className="text-sm font-bold text-muted-foreground/80">No matches</p>
                                <p className="text-xs text-muted-foreground/50 mt-1 max-w-[240px]">
                                    Try a wider date range or clear some filters.
                                </p>
                                <button
                                    onClick={resetFilters}
                                    className="mt-4 text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full bg-primary/15 hover:bg-primary/25 border border-primary/30 text-primary transition-colors"
                                >
                                    Reset filters
                                </button>
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

            {/* Bulk action bar */}
            <AnimatePresence>
                {bulkMode && (
                    <motion.div
                        initial={{ y: 60, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 60, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                        className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-2 px-3 py-2 rounded-2xl bg-card/95 backdrop-blur-xl border border-white/10 shadow-2xl max-w-[calc(100vw-1rem)] flex-wrap justify-center"
                    >
                        <span className="text-xs font-semibold px-2">{selectedIds.size} selected</span>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                if (selectedIds.size === filteredTransactions.length && filteredTransactions.length > 0) {
                                    setSelectedIds(new Set());
                                } else {
                                    setSelectedIds(new Set(filteredTransactions.map(t => t.id)));
                                }
                            }}
                            disabled={filteredTransactions.length === 0}
                            className="h-8 rounded-lg bg-secondary/20 border-white/10 text-xs"
                        >
                            <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
                            {selectedIds.size === filteredTransactions.length && filteredTransactions.length > 0 ? 'Clear' : 'Select all'}
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIsRecategorizeOpen(true)}
                            disabled={selectedIds.size === 0}
                            className="h-8 rounded-lg bg-secondary/20 border-white/10 text-xs"
                        >
                            <Tag className="w-3.5 h-3.5 mr-1.5" /> Recategorize
                        </Button>
                        <Button
                            size="sm"
                            onClick={bulkDelete}
                            disabled={selectedIds.size === 0}
                            className="h-8 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:bg-rose-500/30 text-xs disabled:opacity-50"
                        >
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>

            <Sheet open={isRecategorizeOpen} onOpenChange={setIsRecategorizeOpen}>
                <SheetContent side="bottom" className="border-white/5 bg-background rounded-t-2xl">
                    <SheetHeader>
                        <SheetTitle>Recategorize {selectedIds.size}</SheetTitle>
                        <SheetDescription>Pick a new category for the selected transactions.</SheetDescription>
                    </SheetHeader>
                    <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto py-4">
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => bulkRecategorize(cat.id)}
                                className="flex items-center gap-3 p-3 rounded-xl border bg-secondary/10 border-white/5 hover:border-white/20 transition-colors text-left"
                            >
                                <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center border"
                                    style={{
                                        backgroundColor: `${CATEGORY_COLORS[cat.id] || '#8A2BE2'}20`,
                                        borderColor: `${CATEGORY_COLORS[cat.id] || '#8A2BE2'}40`,
                                    }}
                                >
                                    {React.cloneElement(getIconForCategory(cat.id) as React.ReactElement<{ style?: React.CSSProperties }>, {
                                        style: { color: CATEGORY_COLORS[cat.id] || '#8A2BE2' },
                                    })}
                                </div>
                                <span className="text-sm font-medium">{cat.label}</span>
                            </button>
                        ))}
                    </div>
                </SheetContent>
            </Sheet>
        </motion.div>
    );
}
