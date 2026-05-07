'use client';

import { motion } from 'framer-motion';

import React, { useEffect, useRef, useState, useCallback, useMemo, useDeferredValue } from 'react';
import Link from 'next/link';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useWorkspaceTheme } from '@/hooks/useWorkspaceTheme';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import {
    Calendar, RotateCw, Trash2, ArrowLeft, Tag, X, TrendingUp, TrendingDown,
    Search, Star, MoreVertical, Pause, Play, Clock, ArrowUpDown, Check, BookOpen,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { useBucketsList } from '@/components/providers/buckets-provider';
import { getBucketIcon } from '@/utils/icon-utils';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { format, parseISO, formatDistanceToNowStrict, differenceInCalendarDays } from 'date-fns';
import { useRouter } from 'next/navigation';
import { toast } from '@/utils/haptics';
import { getCategoryLabel, getIconForCategory, CATEGORY_COLORS } from '@/lib/categories';
import type { RecurringTemplate, SubscriptionMetadata } from '@/types/transaction';
import { RecurringDetectCard } from '@/components/recurring-detect-card';

type Tpl = RecurringTemplate;
type Frequency = Tpl['frequency'];
type SortBy = 'next' | 'amount' | 'name' | 'category';
type BucketState = 'all' | 'with' | 'without';

const INACTIVE_PAGE_SIZE = 5;
const ALL_FREQUENCIES: Frequency[] = ['daily', 'weekly', 'monthly', 'yearly'];

const freqToMonthly = (amount: number, freq: Frequency) => {
    if (freq === 'yearly') return amount / 12;
    if (freq === 'weekly') return amount * 4.33;
    if (freq === 'daily') return amount * 30;
    return amount;
};

const getMeta = (t: Tpl): SubscriptionMetadata =>
    (t.metadata && typeof t.metadata === 'object' ? t.metadata : {}) as SubscriptionMetadata;

const SORT_LABELS: Record<SortBy, string> = {
    next: 'Next due',
    amount: 'Amount (high → low)',
    name: 'Name (A → Z)',
    category: 'Category',
};

export function SubscriptionsView() {
    const { userId, formatCurrency, convertAmount, currency, activeWorkspaceId } = useUserPreferences();
    const { theme: themeConfig } = useWorkspaceTheme();
    const { buckets } = useBucketsList();

    const router = useRouter();
    const [templates, setTemplates] = useState<Tpl[]>([]);
    const [loading, setLoading] = useState(true);
    const [cancelTarget, setCancelTarget] = useState<string | null>(null);
    // Bumped on each workspace/user change so in-flight fetches from a previous
    // workspace can't land their results on top of the new one.
    const fetchGenRef = useRef(0);

    type PriceChange = { lastAmount: number; lastDate: string; pctChange: number; templateAmount: number };
    type LastCharge = { lastAmount: number; lastDate: string; pctChange: number };
    const [lastCharges, setLastCharges] = useState<Record<string, LastCharge>>({});
    const [updateTarget, setUpdateTarget] = useState<{ template: Tpl; change: PriceChange } | null>(null);

    const [search, setSearch] = useState('');
    const deferredSearch = useDeferredValue(search);
    const [sortBy, setSortBy] = useState<SortBy>('next');
    const [filterFrequencies, setFilterFrequencies] = useState<Set<Frequency>>(new Set());
    const [filterCategories, setFilterCategories] = useState<Set<string>>(new Set());
    const [bucketState, setBucketState] = useState<BucketState>('all');
    const [showAllInactive, setShowAllInactive] = useState(false);

    const isPaused = useCallback((t: Tpl) => {
        const m = getMeta(t);
        if (!m.pause_until) return false;
        return parseISO(m.pause_until) > new Date();
    }, []);

    const effectiveActive = useCallback((t: Tpl) => t.is_active && !isPaused(t), [isPaused]);

    const loadTemplates = useCallback(async () => {
        if (!userId) return;
        const myGen = fetchGenRef.current;
        setLoading(true);
        let query = supabase
            .from('recurring_templates')
            .select('*')
            .eq('user_id', userId)
            .order('next_occurrence', { ascending: true })
            .limit(200);

        if (activeWorkspaceId) {
            query = query.eq('group_id', activeWorkspaceId);
        }

        const { data, error } = await query;

        if (fetchGenRef.current !== myGen) return;
        if (error) {
            console.error('Failed to load subscriptions', error);
            toast.error("Couldn't load subscriptions");
        } else if (data) {
            // Subscriptions view is for recurring expenses; hide income templates.
            setTemplates((data as Tpl[]).filter(t => !t.is_income));
        }
        setLoading(false);
    }, [userId, activeWorkspaceId]);

    useEffect(() => {
        fetchGenRef.current++;
        loadTemplates();
    }, [loadTemplates]);

    // Capture the most recent matching transaction per active template. We compute
    // pctChange for every match (drift badge still gates display ≥5%), and the
    // "Last charged" line uses lastDate from the same lookup with no extra queries.
    useEffect(() => {
        if (!userId || templates.length === 0) {
            setLastCharges({});
            return;
        }
        let cancelled = false;
        (async () => {
            const active = templates.filter(t => t.is_active);
            const results: Record<string, LastCharge> = {};
            await Promise.all(active.map(async (t) => {
                try {
                    const escapedDesc = t.description.replace(/[%_\\]/g, '\\$&');
                    let q = supabase
                        .from('transactions')
                        .select('amount, date, currency')
                        .eq('user_id', userId)
                        .eq('category', t.category)
                        .ilike('description', escapedDesc)
                        .order('date', { ascending: false })
                        .limit(1);
                    if (activeWorkspaceId) {
                        q = q.eq('group_id', activeWorkspaceId);
                    }
                    const { data } = await q;
                    if (!data || data.length === 0) return;
                    const last = data[0];
                    const lastAmt = Number(last.amount);
                    const tplAmt = Number(t.amount);
                    if (!lastAmt || !tplAmt) return;
                    if ((last.currency || 'USD').toUpperCase() !== (t.currency || 'USD').toUpperCase()) return;
                    const pct = ((lastAmt - tplAmt) / tplAmt) * 100;
                    results[t.id] = {
                        lastAmount: lastAmt,
                        lastDate: last.date,
                        pctChange: pct,
                    };
                } catch (error) {
                    console.error('Error checking last charge for template', t.id, error);
                }
            }));
            if (!cancelled) setLastCharges(results);
        })();
        return () => { cancelled = true; };
    }, [templates, userId, activeWorkspaceId]);

    const handleApplyPriceChange = async () => {
        if (!updateTarget) return;
        const { template, change } = updateTarget;
        setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, amount: change.lastAmount } : t));
        setLastCharges(prev => ({
            ...prev,
            [template.id]: { ...prev[template.id], pctChange: 0 },
        }));
        const { error } = await supabase
            .from('recurring_templates')
            .update({ amount: change.lastAmount })
            .eq('id', template.id);
        if (error) {
            toast.error('Failed to update price');
            loadTemplates();
        } else {
            toast.success('Subscription price updated');
        }
        setUpdateTarget(null);
    };

    useEffect(() => {
        if (!userId) return;

        const templatesChannel = supabase
            .channel(`templates-changes-${userId}-${activeWorkspaceId || 'personal'}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'recurring_templates', filter: `user_id=eq.${userId}` },
                () => { loadTemplates(); }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(templatesChannel);
        };
    }, [userId, activeWorkspaceId, loadTemplates]);

    const updateMetadata = useCallback(async (template: Tpl, partial: Partial<SubscriptionMetadata>) => {
        const existing = getMeta(template);
        const nextMetadata = { ...existing, ...partial };
        setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, metadata: nextMetadata } : t));
        const { error } = await supabase
            .from('recurring_templates')
            .update({ metadata: nextMetadata })
            .eq('id', template.id);
        if (error) {
            toast.error('Failed to update');
            loadTemplates();
            return false;
        }
        return true;
    }, [loadTemplates]);

    const handleAssignBucket = async (template: Tpl, bucketId: string | null) => {
        const ok = await updateMetadata(template, { bucket_id: bucketId });
        if (ok) toast.success(bucketId ? 'Bucket updated' : 'Bucket cleared');
    };

    const togglePin = async (template: Tpl) => {
        const next = !getMeta(template).pinned;
        const ok = await updateMetadata(template, { pinned: next });
        if (ok) toast.success(next ? 'Pinned' : 'Unpinned');
    };

    const setPauseUntil = async (template: Tpl, dateStr: string | null) => {
        const ok = await updateMetadata(template, { pause_until: dateStr });
        if (ok) toast.success(dateStr ? `Paused until ${dateStr}` : 'Resumed');
    };

    const setTrialEndsAt = async (template: Tpl, dateStr: string | null) => {
        const ok = await updateMetadata(template, { trial_ends_at: dateStr });
        if (ok) toast.success(dateStr ? `Trial ends ${dateStr}` : 'Trial cleared');
    };

    const handleToggleActive = async (id: string, currentStatus: boolean) => {
        const newStatus = !currentStatus;
        setTemplates(prev => prev.map(t => t.id === id ? { ...t, is_active: newStatus } : t));

        const { error } = await supabase
            .from('recurring_templates')
            .update({ is_active: newStatus })
            .eq('id', id);

        if (error) {
            toast.error('Failed to update subscription status');
            loadTemplates();
        } else {
            toast.success(newStatus ? 'Subscription re-activated!' : 'Subscription cancelled');
        }
    };

    const totalMonthly = useMemo(() => {
        return templates.filter(effectiveActive).reduce((acc, t) => {
            const inBase = convertAmount(Number(t.amount), t.currency, currency);
            return acc + freqToMonthly(inBase, t.frequency);
        }, 0);
    }, [templates, effectiveActive, convertAmount, currency]);

    const totalYearly = totalMonthly * 12;

    const breakdown = useMemo(() => {
        const acc: Record<Frequency, { count: number; monthly: number }> = {
            daily: { count: 0, monthly: 0 },
            weekly: { count: 0, monthly: 0 },
            monthly: { count: 0, monthly: 0 },
            yearly: { count: 0, monthly: 0 },
        };
        templates.filter(effectiveActive).forEach(t => {
            const inBase = convertAmount(Number(t.amount), t.currency, currency);
            acc[t.frequency].count += 1;
            acc[t.frequency].monthly += freqToMonthly(inBase, t.frequency);
        });
        return acc;
    }, [templates, effectiveActive, convertAmount, currency]);

    const availableCategories = useMemo(() => {
        const set = new Set<string>();
        templates.filter(t => t.is_active).forEach(t => set.add(t.category));
        return Array.from(set).sort();
    }, [templates]);

    const visibleTemplates = useMemo(() => {
        const q = deferredSearch.trim().toLowerCase();
        let active = templates.filter(t => t.is_active);
        if (q) active = active.filter(t => t.description.toLowerCase().includes(q));
        if (filterFrequencies.size > 0) active = active.filter(t => filterFrequencies.has(t.frequency));
        if (filterCategories.size > 0) active = active.filter(t => filterCategories.has(t.category));
        if (bucketState !== 'all') {
            active = active.filter(t => {
                const has = !!getMeta(t).bucket_id;
                return bucketState === 'with' ? has : !has;
            });
        }
        return active.sort((a, b) => {
            const aPin = getMeta(a).pinned ? 1 : 0;
            const bPin = getMeta(b).pinned ? 1 : 0;
            if (aPin !== bPin) return bPin - aPin;
            switch (sortBy) {
                case 'amount': return Number(b.amount) - Number(a.amount);
                case 'name': return a.description.localeCompare(b.description);
                case 'category': return a.category.localeCompare(b.category);
                default: return parseISO(a.next_occurrence).getTime() - parseISO(b.next_occurrence).getTime();
            }
        });
    }, [templates, deferredSearch, filterFrequencies, filterCategories, bucketState, sortBy]);

    const inactiveTemplates = useMemo(
        () => templates.filter(t => !t.is_active),
        [templates]
    );

    const hasActiveFilters = filterFrequencies.size > 0 || filterCategories.size > 0 || bucketState !== 'all';

    const toggleFrequency = (f: Frequency) => {
        setFilterFrequencies(prev => {
            const next = new Set(prev);
            if (next.has(f)) next.delete(f); else next.add(f);
            return next;
        });
    };

    const toggleCategory = (c: string) => {
        setFilterCategories(prev => {
            const next = new Set(prev);
            if (next.has(c)) next.delete(c); else next.add(c);
            return next;
        });
    };

    const clearFilters = () => {
        setFilterFrequencies(new Set());
        setFilterCategories(new Set());
        setBucketState('all');
    };

    const totalActiveCount = templates.filter(effectiveActive).length;
    const pausedCount = templates.filter(t => t.is_active && isPaused(t)).length;

    return (
        <>
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 220, damping: 28, mass: 0.9 }}
            className="relative min-h-screen w-full"
        >


            <div className="p-5 space-y-6 max-w-md lg:max-w-4xl mx-auto relative min-h-screen z-10">
                <div className="flex items-center justify-between relative min-h-[40px] mb-2">
                <button
                    onClick={() => router.back()}
                    aria-label="Go back"
                    className="w-10 h-10 rounded-full bg-secondary/30 hover:bg-secondary/50 flex items-center justify-center transition-colors shrink-0 z-10"
                >
                    <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                </button>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <h1 className="text-lg font-semibold flex items-center gap-2">
                        <RotateCw className={`w-5 h-5 ${themeConfig.text}`} />
                        Subscriptions
                    </h1>
                </div>
                <div className="w-10 shrink-0 z-10" />
            </div>

            <Card className={cn(`bg-gradient-to-br backdrop-blur-md`, themeConfig.gradient, themeConfig.border)}>
                <CardContent className="p-6">
                    <p className="text-sm text-muted-foreground font-medium mb-1">Estimated Monthly Cost</p>
                    <h2 className={`text-3xl font-bold ${themeConfig.text}`}>{formatCurrency(totalMonthly)}</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                        ≈ {formatCurrency(totalYearly)} / yr
                        <span className="opacity-60">
                            {' · '}{totalActiveCount} active
                            {pausedCount > 0 ? ` · ${pausedCount} paused` : ''}
                        </span>
                    </p>
                    {totalActiveCount > 0 && (
                        <div className="grid grid-cols-2 gap-2 mt-4">
                            {ALL_FREQUENCIES.filter(f => breakdown[f].count > 0).map(f => (
                                <div
                                    key={f}
                                    className={cn(
                                        "rounded-xl border px-3 py-2 bg-card/30",
                                        themeConfig.border
                                    )}
                                >
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                                        {f}
                                    </p>
                                    <p className="text-sm font-bold mt-0.5">
                                        {breakdown[f].count} <span className="text-[10px] text-muted-foreground font-normal">·</span>{' '}
                                        <span className={themeConfig.text}>{formatCurrency(breakdown[f].monthly)}/mo</span>
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {totalActiveCount > 0 && (
                <div className="space-y-2">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                            <Input
                                id="subs-search"
                                name="subs-search"
                                autoComplete="off"
                                placeholder="Search subscriptions"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className={`pl-9 pr-9 bg-secondary/10 border-white/10 h-10 rounded-xl ${themeConfig.ring}`}
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    aria-label="Clear search"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <Popover>
                            <PopoverTrigger asChild>
                                <button
                                    type="button"
                                    className={cn(
                                        "h-10 px-3 rounded-xl bg-secondary/10 border border-white/10 inline-flex items-center gap-1.5 text-xs font-bold shrink-0",
                                        themeConfig.text
                                    )}
                                    aria-label="Sort subscriptions"
                                >
                                    <ArrowUpDown className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span className="hidden sm:inline">{SORT_LABELS[sortBy]}</span>
                                </button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-56 p-1 bg-card/95 backdrop-blur-xl border-white/10">
                                {(Object.keys(SORT_LABELS) as SortBy[]).map(opt => (
                                    <button
                                        key={opt}
                                        type="button"
                                        onClick={() => setSortBy(opt)}
                                        className={cn(
                                            "w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-secondary/30 transition-colors",
                                            sortBy === opt && "bg-secondary/30"
                                        )}
                                    >
                                        <span>{SORT_LABELS[opt]}</span>
                                        {sortBy === opt && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                                    </button>
                                ))}
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                        {ALL_FREQUENCIES.map(f => (
                            <button
                                key={f}
                                type="button"
                                onClick={() => toggleFrequency(f)}
                                className={cn(
                                    "shrink-0 capitalize px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors",
                                    filterFrequencies.has(f)
                                        ? cn(themeConfig.bgMedium, themeConfig.borderMedium, themeConfig.text)
                                        : "bg-secondary/20 border-white/10 text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {f}
                            </button>
                        ))}
                        <span className="w-px h-4 bg-white/10 shrink-0 mx-1" aria-hidden="true" />
                        {(['all', 'with', 'without'] as BucketState[]).map(opt => (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => setBucketState(opt)}
                                className={cn(
                                    "shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors",
                                    bucketState === opt
                                        ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-300"
                                        : "bg-secondary/20 border-white/10 text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {opt === 'all' ? 'Any bucket' : opt === 'with' ? 'With bucket' : 'No bucket'}
                            </button>
                        ))}
                        {availableCategories.length > 1 && (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <button
                                        type="button"
                                        className={cn(
                                            "shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors inline-flex items-center gap-1",
                                            filterCategories.size > 0
                                                ? "bg-violet-500/15 border-violet-500/30 text-violet-300"
                                                : "bg-secondary/20 border-white/10 text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <Tag className="w-2.5 h-2.5" aria-hidden="true" />
                                        {filterCategories.size > 0 ? `Categories (${filterCategories.size})` : 'Category'}
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent align="start" className="w-56 p-1 bg-card/95 backdrop-blur-xl border-white/10 max-h-72 overflow-y-auto">
                                    {availableCategories.map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => toggleCategory(c)}
                                            className={cn(
                                                "w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-secondary/30 transition-colors",
                                                filterCategories.has(c) && "bg-violet-500/10 text-violet-300"
                                            )}
                                        >
                                            <span className="flex items-center gap-2 min-w-0">
                                                <span className="w-3 h-3 inline-flex items-center justify-center shrink-0">
                                                    {getIconForCategory(c, "w-full h-full", { style: { color: CATEGORY_COLORS[c] || CATEGORY_COLORS.others } })}
                                                </span>
                                                <span className="truncate">{getCategoryLabel(c)}</span>
                                            </span>
                                            {filterCategories.has(c) && <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                                        </button>
                                    ))}
                                </PopoverContent>
                            </Popover>
                        )}
                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold text-rose-400 hover:text-rose-300 inline-flex items-center gap-1"
                            >
                                <X className="w-2.5 h-2.5" aria-hidden="true" /> Clear
                            </button>
                        )}
                    </div>
                </div>
            )}

            <RecurringDetectCard
                userId={userId}
                activeWorkspaceId={activeWorkspaceId}
                templates={templates}
                formatCurrency={formatCurrency}
                onCreated={loadTemplates}
            />

            <div className="space-y-3">
                <h3 className="text-lg font-bold mb-4">Upcoming Renewals</h3>

                {loading ? (
                    <div className="space-y-3">
                        <div className="h-20 w-full rounded-3xl bg-secondary/10 animate-pulse" />
                        <div className="h-20 w-full rounded-3xl bg-secondary/10 animate-pulse" />
                        <div className="h-20 w-full rounded-3xl bg-secondary/10 animate-pulse" />
                    </div>
                ) : templates.filter(t => t.is_active).length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground border border-dashed border-white/10 rounded-3xl">
                        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>No active subscriptions found.</p>
                        <p className="text-xs opacity-70 mt-1">Add a recurring expense to see it here.</p>
                        <Link
                            href="/guide#recurring"
                            className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-primary"
                        >
                            <BookOpen className="h-3 w-3" />
                            New here? Read about Recurring &amp; subscriptions
                        </Link>
                    </div>
                ) : visibleTemplates.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground border border-dashed border-white/10 rounded-3xl">
                        <p className="text-sm">No subscriptions match your filters.</p>
                        <button
                            type="button"
                            onClick={() => { setSearch(''); clearFilters(); }}
                            className={cn("text-xs font-bold mt-2", themeConfig.text)}
                        >
                            Clear all
                        </button>
                    </div>
                ) : (
                    visibleTemplates.map((template) => {
                        const meta = getMeta(template);
                        const bucketId = meta.bucket_id ?? null;
                        const linkedBucket = bucketId ? buckets.find(b => b.id === bucketId) : null;
                        const lastCharge = lastCharges[template.id];
                        const drift = lastCharge && Math.abs(lastCharge.pctChange) >= 5
                            ? { ...lastCharge, templateAmount: Number(template.amount) }
                            : null;
                        const paused = isPaused(template);
                        const trialEnds = meta.trial_ends_at ? parseISO(meta.trial_ends_at) : null;
                        const trialActive = trialEnds && trialEnds > new Date();
                        const trialEnded = trialEnds && trialEnds <= new Date();
                        const showConvertedHint = template.currency && template.currency.toUpperCase() !== currency.toUpperCase();
                        return (
                        <Card
                            key={template.id}
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
                                                        onClick={() => handleAssignBucket(template, null)}
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
                                                            onClick={() => handleAssignBucket(template, b.id)}
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
                                            onClick={() => setUpdateTarget({ template, change: drift })}
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
                                        onTogglePin={togglePin}
                                        onSetPause={setPauseUntil}
                                        onSetTrial={setTrialEndsAt}
                                        onCancel={(id) => setCancelTarget(id)}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                        );
                    })
                )}
            </div>

            {inactiveTemplates.length > 0 && (
                 <div className="pt-6 border-t border-white/10 space-y-3">
                     <div className="flex items-center justify-between">
                         <h3 className="text-sm font-bold text-muted-foreground">
                             Inactive Subscriptions ({inactiveTemplates.length})
                         </h3>
                         {inactiveTemplates.length > INACTIVE_PAGE_SIZE && (
                             <button
                                 type="button"
                                 onClick={() => setShowAllInactive(s => !s)}
                                 className={cn("text-[10px] font-bold uppercase tracking-wider", themeConfig.text)}
                             >
                                 {showAllInactive ? 'Show less' : `Show all (${inactiveTemplates.length})`}
                             </button>
                         )}
                     </div>
                     {(showAllInactive ? inactiveTemplates : inactiveTemplates.slice(0, INACTIVE_PAGE_SIZE)).map((template) => (
                         <div key={template.id} className={cn("flex justify-between items-center p-3 rounded-xl bg-secondary/10 opacity-70 border border-white/5 group", themeConfig.bg)}>
                             <div className="flex items-center gap-3">
                                 <RotateCw className={cn("w-4 h-4", themeConfig.text)} />
                                 <span className="font-medium text-sm line-through opacity-60">{template.description}</span>
                             </div>
                             <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-muted-foreground">{formatCurrency(template.amount, template.currency)} / {template.frequency}</span>
                                <button
                                    onClick={() => handleToggleActive(template.id, false)}
                                    className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors", themeConfig.text)}
                                >
                                    Re-activate
                                </button>
                             </div>
                         </div>
                     ))}
                 </div>
            )}

            </div>
        </motion.div>

        <AlertDialog open={!!updateTarget} onOpenChange={(open) => !open && setUpdateTarget(null)}>
            <AlertDialogContent className="bg-card/95 backdrop-blur-xl border-white/10 rounded-3xl">
                <AlertDialogHeader>
                    <AlertDialogTitle>Update subscription price?</AlertDialogTitle>
                    <AlertDialogDescription>
                        {updateTarget && (
                            <>
                                Most recent <span className="font-semibold text-foreground">{updateTarget.template.description}</span> charge was{' '}
                                <span className="font-bold text-foreground">{formatCurrency(updateTarget.change.lastAmount, updateTarget.template.currency)}</span>{' '}
                                on {format(parseISO(updateTarget.change.lastDate), 'MMM d, yyyy')}.
                                Template currently shows{' '}
                                <span className="font-bold text-foreground">{formatCurrency(updateTarget.change.templateAmount, updateTarget.template.currency)}</span>.
                                Update template to match the new price?
                            </>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setUpdateTarget(null)}>Keep current</AlertDialogCancel>
                    <AlertDialogAction
                        className={cn("border", themeConfig.bgSolid, themeConfig.borderSolid, themeConfig.textWhite, themeConfig.hoverBg)}
                        onClick={handleApplyPriceChange}
                    >
                        Update price
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
            <AlertDialogContent className="bg-card/95 backdrop-blur-xl border-white/10 rounded-3xl">
                <AlertDialogHeader>
                    <AlertDialogTitle>Cancel this subscription?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Future transactions for this subscription will not be created automatically. You can re-activate it anytime.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setCancelTarget(null)}>Keep</AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30"
                        onClick={() => { if (cancelTarget) { handleToggleActive(cancelTarget, true); setCancelTarget(null); } }}
                    >
                        Cancel Subscription
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}

type RowActionsMenuProps = {
    template: Tpl;
    meta: SubscriptionMetadata;
    paused: boolean;
    onTogglePin: (t: Tpl) => void;
    onSetPause: (t: Tpl, dateStr: string | null) => void;
    onSetTrial: (t: Tpl, dateStr: string | null) => void;
    onCancel: (id: string) => void;
};

function RowActionsMenu({ template, meta, paused, onTogglePin, onSetPause, onSetTrial, onCancel }: RowActionsMenuProps) {
    const [open, setOpen] = useState(false);
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground p-1 transition-colors"
                    aria-label="Subscription actions"
                >
                    <MoreVertical className="w-4 h-4" aria-hidden="true" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-1 bg-card/95 backdrop-blur-xl border-white/10">
                <button
                    type="button"
                    onClick={() => { onTogglePin(template); setOpen(false); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-secondary/30 transition-colors text-left"
                >
                    <Star className={cn("w-3.5 h-3.5", meta.pinned && "fill-amber-400 text-amber-400")} aria-hidden="true" />
                    <span>{meta.pinned ? 'Unpin' : 'Pin to top'}</span>
                </button>

                {paused ? (
                    <button
                        type="button"
                        onClick={() => { onSetPause(template, null); setOpen(false); }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-secondary/30 transition-colors text-left"
                    >
                        <Play className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                        <span>Resume now</span>
                    </button>
                ) : (
                    <label className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-secondary/30 transition-colors cursor-pointer">
                        <Pause className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                        <span className="flex-1">Pause until…</span>
                        <input
                            type="date"
                            min={todayStr}
                            onChange={(e) => {
                                if (e.target.value) {
                                    onSetPause(template, e.target.value);
                                    setOpen(false);
                                }
                            }}
                            className="bg-transparent text-[10px] w-[88px] text-muted-foreground"
                            aria-label="Pause until date"
                        />
                    </label>
                )}

                {meta.trial_ends_at ? (
                    <button
                        type="button"
                        onClick={() => { onSetTrial(template, null); setOpen(false); }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-secondary/30 transition-colors text-left"
                    >
                        <Clock className="w-3.5 h-3.5 text-rose-300" aria-hidden="true" />
                        <span>Clear trial</span>
                    </button>
                ) : (
                    <label className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-secondary/30 transition-colors cursor-pointer">
                        <Clock className="w-3.5 h-3.5 text-rose-300" aria-hidden="true" />
                        <span className="flex-1">Trial ends…</span>
                        <input
                            type="date"
                            min={todayStr}
                            onChange={(e) => {
                                if (e.target.value) {
                                    onSetTrial(template, e.target.value);
                                    setOpen(false);
                                }
                            }}
                            className="bg-transparent text-[10px] w-[88px] text-muted-foreground"
                            aria-label="Trial ends date"
                        />
                    </label>
                )}

                <div className="my-1 h-px bg-white/10" />

                <button
                    type="button"
                    onClick={() => { onCancel(template.id); setOpen(false); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-rose-500/10 text-rose-400 transition-colors text-left"
                >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Cancel subscription</span>
                </button>
            </PopoverContent>
        </Popover>
    );
}
