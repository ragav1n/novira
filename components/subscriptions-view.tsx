'use client';

import { motion } from 'framer-motion';
import React, { useEffect, useRef, useState, useCallback, useMemo, useDeferredValue } from 'react';
import Link from 'next/link';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useWorkspaceTheme } from '@/hooks/useWorkspaceTheme';
import { supabase } from '@/lib/supabase';
import { Calendar, RotateCw, ArrowLeft, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import { toast } from '@/utils/haptics';
import type { SubscriptionMetadata } from '@/types/transaction';
import { RecurringDetectCard } from '@/components/recurring-detect-card';
import {
    freqToMonthly, getMeta,
    type Tpl, type Frequency, type SortBy, type BucketState,
    type PriceChange, type LastCharge,
} from '@/lib/subscriptions-utils';
import { SubscriptionSummaryCard } from '@/components/subscriptions/subscription-summary-card';
import { SubscriptionFilters } from '@/components/subscriptions/subscription-filters';
import { SubscriptionRow } from '@/components/subscriptions/subscription-row';
import { InactiveSubscriptions } from '@/components/subscriptions/inactive-subscriptions';
import { PriceChangeDialog, CancelSubscriptionDialog } from '@/components/subscriptions/subscription-dialogs';

export function SubscriptionsView() {
    const { userId, formatCurrency, convertAmount, currency, activeWorkspaceId } = useUserPreferences();
    const { theme: themeConfig } = useWorkspaceTheme();
    const router = useRouter();

    const [templates, setTemplates] = useState<Tpl[]>([]);
    const [loading, setLoading] = useState(true);
    const [cancelTarget, setCancelTarget] = useState<string | null>(null);
    const [lastCharges, setLastCharges] = useState<Record<string, LastCharge>>({});
    const [updateTarget, setUpdateTarget] = useState<{ template: Tpl; change: PriceChange } | null>(null);
    // Bumped on each workspace/user change so in-flight fetches from a previous
    // workspace can't land their results on top of the new one.
    const fetchGenRef = useRef(0);

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

    const handleAssignBucket = useCallback(async (template: Tpl, bucketId: string | null) => {
        const ok = await updateMetadata(template, { bucket_id: bucketId });
        if (ok) toast.success(bucketId ? 'Bucket updated' : 'Bucket cleared');
    }, [updateMetadata]);

    const togglePin = useCallback(async (template: Tpl) => {
        const next = !getMeta(template).pinned;
        const ok = await updateMetadata(template, { pinned: next });
        if (ok) toast.success(next ? 'Pinned' : 'Unpinned');
    }, [updateMetadata]);

    const setPauseUntil = useCallback(async (template: Tpl, dateStr: string | null) => {
        const ok = await updateMetadata(template, { pause_until: dateStr });
        if (ok) toast.success(dateStr ? `Paused until ${dateStr}` : 'Resumed');
    }, [updateMetadata]);

    const setTrialEndsAt = useCallback(async (template: Tpl, dateStr: string | null) => {
        const ok = await updateMetadata(template, { trial_ends_at: dateStr });
        if (ok) toast.success(dateStr ? `Trial ends ${dateStr}` : 'Trial cleared');
    }, [updateMetadata]);

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

                    <SubscriptionSummaryCard
                        totalMonthly={totalMonthly}
                        totalYearly={totalYearly}
                        totalActiveCount={totalActiveCount}
                        pausedCount={pausedCount}
                        breakdown={breakdown}
                    />

                    {totalActiveCount > 0 && (
                        <SubscriptionFilters
                            search={search}
                            setSearch={setSearch}
                            sortBy={sortBy}
                            setSortBy={setSortBy}
                            filterFrequencies={filterFrequencies}
                            onToggleFrequency={toggleFrequency}
                            bucketState={bucketState}
                            setBucketState={setBucketState}
                            availableCategories={availableCategories}
                            filterCategories={filterCategories}
                            onToggleCategory={toggleCategory}
                            hasActiveFilters={hasActiveFilters}
                            onClearFilters={clearFilters}
                        />
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
                            visibleTemplates.map((template) => (
                                <SubscriptionRow
                                    key={template.id}
                                    template={template}
                                    lastCharge={lastCharges[template.id]}
                                    onTogglePin={togglePin}
                                    onSetPause={setPauseUntil}
                                    onSetTrial={setTrialEndsAt}
                                    onAssignBucket={handleAssignBucket}
                                    onCancel={(id) => setCancelTarget(id)}
                                    onRequestPriceUpdate={setUpdateTarget}
                                />
                            ))
                        )}
                    </div>

                    <InactiveSubscriptions
                        templates={inactiveTemplates}
                        showAll={showAllInactive}
                        onToggleShowAll={() => setShowAllInactive(s => !s)}
                        onReactivate={(id) => handleToggleActive(id, false)}
                    />
                </div>
            </motion.div>

            <PriceChangeDialog
                target={updateTarget}
                onClose={() => setUpdateTarget(null)}
                onApply={handleApplyPriceChange}
            />

            <CancelSubscriptionDialog
                open={!!cancelTarget}
                onClose={() => setCancelTarget(null)}
                onConfirm={() => { if (cancelTarget) { handleToggleActive(cancelTarget, true); setCancelTarget(null); } }}
            />
        </>
    );
}
