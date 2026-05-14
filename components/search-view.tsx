'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    ChevronLeft, Search, Tag, Plane, Home, Gift,
    Car, Utensils, ShoppingCart, Heart, Gamepad2, School, Laptop, Music,
    X, RefreshCcw, Ban, CheckSquare, Bookmark, BookmarkPlus,
} from 'lucide-react';
import { CATEGORY_COLORS, getIconForCategory, getCategoryLabel } from '@/lib/categories';
import { ReceiptViewerDialog } from '@/components/receipt-viewer-dialog';
import { useReceiptViewer } from '@/hooks/useReceiptViewer';
import { useAccounts } from '@/components/providers/accounts-provider';
import { Transaction } from '@/types/transaction';
import { enqueueMutation } from '@/lib/sync-manager';
import { motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast, ImpactStyle } from '@/utils/haptics';
import { format } from 'date-fns';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useBucketsList } from '@/components/providers/buckets-provider';
import { useWorkspaceTheme } from '@/hooks/useWorkspaceTheme';
import { useTransactionInvalidationListener } from '@/hooks/useTransactionInvalidationListener';
import { useDebounce } from '@/hooks/useDebounce';
import { loadPresets, savePreset, deletePreset, type SearchPreset, type SearchFilterSnapshot } from '@/lib/search-presets';
import {
    parseNumericQuery, rangeMatches, getQuickRange,
    type DateRange, type SortOption, type QuickRangeId,
} from '@/lib/search-utils';
import { SearchFilterSheet } from '@/components/search/search-filter-sheet';
import { SearchResultsList } from '@/components/search/search-results-list';
import { BulkActionBar } from '@/components/search/bulk-action-bar';
import { RecategorizeSheet } from '@/components/search/recategorize-sheet';

const bucketIcons: Record<string, React.ElementType> = {
    Tag, Plane, Home, Gift, Car, Utensils, ShoppingCart,
    Heart, Gamepad2, School, Laptop, Music,
};

function BucketIcon({ name }: { name?: string }) {
    const Icon = bucketIcons[name || 'Tag'] || Tag;
    return <Icon className="w-full h-full" />;
}

export function SearchView() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
    const [searchQuery, setSearchQuery] = useState(() => searchParams?.get('q') || '');
    const [loading, setLoading] = useState(true);
    const { formatCurrency, convertAmount, activeWorkspaceId, userId } = useUserPreferences();
    const { buckets } = useBucketsList();
    const { theme: themeConfig } = useWorkspaceTheme();
    const receiptViewer = useReceiptViewer();
    const { activeAccountId } = useAccounts();
    // Bumped on each workspace/user change so in-flight fetches from a previous
    // workspace can't land their results on top of the new one.
    const fetchGenRef = useRef(0);

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

    const fetchAndFilter = useCallback(async () => {
        const myGen = fetchGenRef.current;
        setLoading(true);
        try {
            let query = supabase
                .from('transactions')
                .select('id, description, amount, category, date, payment_method, created_at, user_id, group_id, currency, exchange_rate, base_currency, is_recurring, is_settlement, exclude_from_allowance, bucket_id, place_name, place_address, place_lat, place_lng, tags, notes, receipt_path, profile:profiles(full_name, avatar_url), splits(user_id, amount, is_paid)');

            // Workspace filter — when null, RLS limits results to rows the user can see.
            if (activeWorkspaceId) {
                query = query.eq('group_id', activeWorkspaceId);
            }

            // Account filter — personal workspace only (group rows are on each
            // member's own account, so a single-account filter would hide partners).
            if (!activeWorkspaceId && activeAccountId) {
                query = query.eq('account_id', activeAccountId);
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

            if (selectedCategories.length > 0) query = query.in('category', selectedCategories);
            if (selectedPayments.length > 0) query = query.in('payment_method', selectedPayments);
            if (dateRange.from) query = query.gte('date', format(dateRange.from, 'yyyy-MM-dd'));
            if (dateRange.to) query = query.lte('date', format(dateRange.to, 'yyyy-MM-dd'));
            if (priceRange[0] > 0) query = query.gte('amount', priceRange[0]);
            if (priceRange[1] < maxPossiblePrice) query = query.lte('amount', priceRange[1]);
            if (selectedBucketId) query = query.eq('bucket_id', selectedBucketId);
            // Tag filter — match transactions that contain ALL selected tags.
            if (selectedTags.length > 0) query = query.contains('tags', selectedTags);
            if (showRecurringOnly) query = query.eq('is_recurring', true);
            if (showExcludedOnly) query = query.eq('exclude_from_allowance', true);

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
    }, [activeWorkspaceId, activeAccountId, debouncedSearchQuery, selectedCategories, selectedPayments, dateRange, priceRange, selectedBucketId, selectedTags, sortBy, maxPossiblePrice, showRecurringOnly, showExcludedOnly]);

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

        const txFilter = activeWorkspaceId
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

    const resetFilters = useCallback(() => {
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
    }, [maxPossiblePrice]);

    const activeFilterCount = useMemo(() => {
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
    }, [priceRange, maxPossiblePrice, selectedCategories, selectedPayments, dateRange, selectedBucketId, selectedTags, showRecurringOnly, showExcludedOnly]);

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

    const toggleSelectAll = useCallback(() => {
        if (selectedIds.size === filteredTransactions.length && filteredTransactions.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredTransactions.map(t => t.id)));
        }
    }, [selectedIds.size, filteredTransactions]);

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

                    <SearchFilterSheet
                        open={isFilterSheetOpen}
                        onOpenChange={setIsFilterSheetOpen}
                        activeFilterCount={activeFilterCount}
                        sortBy={sortBy}
                        setSortBy={setSortBy}
                        priceRange={priceRange}
                        setPriceRange={setPriceRange}
                        maxPossiblePrice={maxPossiblePrice}
                        dateRange={dateRange}
                        setDateRange={setDateRange}
                        selectedBucketId={selectedBucketId}
                        setSelectedBucketId={setSelectedBucketId}
                        knownTags={knownTags}
                        selectedTags={selectedTags}
                        setSelectedTags={setSelectedTags}
                        selectedCategories={selectedCategories}
                        setSelectedCategories={setSelectedCategories}
                        selectedPayments={selectedPayments}
                        setSelectedPayments={setSelectedPayments}
                        onReset={resetFilters}
                    />
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
                {activeFilterCount > 0 && (
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
                {activeFilterCount > 0 && (
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
                                    <BucketIcon name={buckets.find(b => b.id === selectedBucketId)?.icon} />
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
                {activeFilterCount > 0 && filterStats && (
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
                    <SearchResultsList
                        transactions={filteredTransactions}
                        loading={loading}
                        sortBy={sortBy}
                        bulkMode={bulkMode}
                        selectedIds={selectedIds}
                        toggleSelection={toggleSelection}
                        debouncedSearchQuery={debouncedSearchQuery}
                        onViewReceipt={receiptViewer.view}
                        onResetFilters={resetFilters}
                    />
                </div>

                {/* Total Footer */}
                <div className="pt-4 border-t border-white/5 flex-shrink-0">
                    <div className="flex justify-between items-center px-2">
                        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-widest">{filteredTransactions.length} transactions match</p>
                        <button onClick={resetFilters} className="text-[11px] text-primary font-bold hover:underline">RESET</button>
                    </div>
                </div>
            </div>

            <BulkActionBar
                visible={bulkMode}
                selectedCount={selectedIds.size}
                totalCount={filteredTransactions.length}
                onToggleSelectAll={toggleSelectAll}
                onOpenRecategorize={() => setIsRecategorizeOpen(true)}
                onBulkDelete={bulkDelete}
            />

            <RecategorizeSheet
                open={isRecategorizeOpen}
                onOpenChange={setIsRecategorizeOpen}
                selectedCount={selectedIds.size}
                onRecategorize={bulkRecategorize}
            />

            <ReceiptViewerDialog
                open={receiptViewer.open}
                onOpenChange={receiptViewer.setOpen}
                receiptPath={receiptViewer.path}
            />
        </motion.div>
    );
}
