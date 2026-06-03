'use client';

import { motion, AnimatePresence } from 'framer-motion';
import React, { useEffect, useRef, useState, useCallback, useMemo, useDeferredValue } from 'react';
import Link from 'next/link';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useWorkspaceTheme } from '@/hooks/useWorkspaceTheme';
import { supabase } from '@/lib/supabase';
import { Calendar, ChevronLeft, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { differenceInCalendarDays, parseISO } from 'date-fns';
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
import { EditSubscriptionDialog } from '@/components/subscriptions/edit-subscription-dialog';

export function SubscriptionsView() {
    const { userId, formatCurrency, convertAmount, currency, activeWorkspaceId } = useUserPreferences();
    const { theme: themeConfig } = useWorkspaceTheme();
    const router = useRouter();

    const [templates, setTemplates] = useState<Tpl[]>([]);
    const [loading, setLoading] = useState(true);
    const [cancelTarget, setCancelTarget] = useState<string | null>(null);
    const [editTarget, setEditTarget] = useState<Tpl | null>(null);
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

    const loadTemplates = useCallback(async (opts: { silent?: boolean } = {}) => {
        if (!userId) return;
        const myGen = fetchGenRef.current;
        if (!opts.silent) setLoading(true);
        let query = supabase
            .from('recurring_templates')
            .select('id, description, amount, currency, frequency, next_occurrence, category, is_active, is_income, created_at, user_id, group_id, payment_method, metadata')
            .eq('user_id', userId)
            .order('next_occurrence', { ascending: true })
            .limit(200);

        if (activeWorkspaceId) {
            query = query.eq('group_id', activeWorkspaceId);
        }

        const { data, error } = await query;

        if (fetchGenRef.current !== myGen) return;
        if (error) {
            console.error('Failed to load subscriptions:', {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint,
            });
            if (!opts.silent) toast.error("Couldn't load subscriptions");
        } else if (data) {
            // Subscriptions view is for recurring expenses; hide income templates.
            setTemplates((data as Tpl[]).filter(t => !t.is_income));
        }
        if (!opts.silent) setLoading(false);
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
                    const rawLast = Number(last.amount);
                    const tplAmt = Number(t.amount);
                    if (!rawLast || !tplAmt) return;
                    // Normalize the charge into the template's currency before comparing —
                    // otherwise a charge logged in a different currency mixes scales and the
                    // percentage is meaningless.
                    const tplCurr = t.currency || currency;
                    const lastAmt = convertAmount(rawLast, last.currency || tplCurr, tplCurr);
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
    }, [templates, userId, activeWorkspaceId, convertAmount, currency]);

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

        const matchesWorkspace = (row: Partial<Tpl> | null | undefined) => {
            if (!row) return false;
            if (activeWorkspaceId) return row.group_id === activeWorkspaceId;
            return !row.group_id;
        };

        const templatesChannel = supabase
            .channel(`templates-changes-${userId}-${activeWorkspaceId || 'personal'}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'recurring_templates', filter: `user_id=eq.${userId}` },
                (payload) => {
                    const row = payload.new as Tpl;
                    if (!matchesWorkspace(row) || row.is_income) return;
                    setTemplates(prev => prev.some(t => t.id === row.id) ? prev : [...prev, row]);
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'recurring_templates', filter: `user_id=eq.${userId}` },
                (payload) => {
                    const row = payload.new as Tpl;
                    if (!matchesWorkspace(row)) {
                        setTemplates(prev => prev.filter(t => t.id !== row.id));
                        return;
                    }
                    if (row.is_income) {
                        setTemplates(prev => prev.filter(t => t.id !== row.id));
                        return;
                    }
                    setTemplates(prev => {
                        const exists = prev.some(t => t.id === row.id);
                        return exists
                            ? prev.map(t => t.id === row.id ? { ...t, ...row } : t)
                            : [...prev, row];
                    });
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'recurring_templates', filter: `user_id=eq.${userId}` },
                (payload) => {
                    const oldRow = payload.old as Partial<Tpl>;
                    if (!oldRow?.id) return;
                    setTemplates(prev => prev.filter(t => t.id !== oldRow.id));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(templatesChannel);
        };
    }, [userId, activeWorkspaceId]);

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
        // Bump trial-ending-within-7-days to the top regardless of user sort so the
        // user can act before the charge lands. Pinned still wins overall.
        const now = new Date();
        const isTrialEndingSoon = (t: Tpl): boolean => {
            const ends = getMeta(t).trial_ends_at;
            if (!ends) return false;
            const dt = parseISO(ends);
            if (dt <= now) return false;
            return differenceInCalendarDays(dt, now) <= 7;
        };
        return active.sort((a, b) => {
            const aPin = getMeta(a).pinned ? 1 : 0;
            const bPin = getMeta(b).pinned ? 1 : 0;
            if (aPin !== bPin) return bPin - aPin;
            const aTrial = isTrialEndingSoon(a) ? 1 : 0;
            const bTrial = isTrialEndingSoon(b) ? 1 : 0;
            if (aTrial !== bTrial) return bTrial - aTrial;
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

    const nextTrialEnding = useMemo(() => {
        const now = new Date();
        let best: { description: string; daysLeft: number } | null = null;
        for (const t of templates) {
            if (!t.is_active) continue;
            const ends = getMeta(t).trial_ends_at;
            if (!ends) continue;
            const dt = parseISO(ends);
            if (dt <= now) continue;
            const daysLeft = differenceInCalendarDays(dt, now);
            if (daysLeft > 7) continue;
            if (!best || daysLeft < best.daysLeft) {
                best = { description: t.description, daysLeft };
            }
        }
        return best;
    }, [templates]);

    return (
        <>
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 220, damping: 28, mass: 0.9 }}
                className="relative min-h-[100dvh] w-full bg-[radial-gradient(ellipse_90%_60%_at_50%_-10%,_rgba(138,43,226,0.18),_transparent_60%)]"
            >
                <div className="p-5 space-y-7 max-w-md lg:max-w-2xl mx-auto relative pb-24 lg:pb-8 z-10">
                    <div className="relative flex items-center gap-3 min-h-[40px]">
                        <button
                            onClick={() => router.back()}
                            aria-label="Go back"
                            className="p-2 -ml-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors shrink-0 z-10"
                        >
                            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                        </button>
                        <h2 className="absolute inset-0 flex items-center justify-center pointer-events-none text-lg font-semibold tracking-tight">
                            Subscriptions
                        </h2>
                    </div>

                    <SubscriptionSummaryCard
                        totalMonthly={totalMonthly}
                        totalYearly={totalYearly}
                        totalActiveCount={totalActiveCount}
                        pausedCount={pausedCount}
                        breakdown={breakdown}
                        nextTrialEnding={nextTrialEnding}
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
                        <div className="flex items-end justify-between">
                            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                                Upcoming renewals
                            </p>
                            {!loading && visibleTemplates.length > 0 && (
                                <span className="text-[11px] text-muted-foreground/70 tabular-nums">
                                    {visibleTemplates.length} item{visibleTemplates.length === 1 ? '' : 's'}
                                </span>
                            )}
                        </div>

                        {loading ? (
                            <div className="space-y-3" role="status" aria-label="Loading subscriptions">
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
                            <AnimatePresence initial={false} mode="popLayout">
                                {visibleTemplates.map((template) => (
                                    <motion.div
                                        key={template.id}
                                        layout
                                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -8, scale: 0.97 }}
                                        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                                    >
                                        <SubscriptionRow
                                            template={template}
                                            lastCharge={lastCharges[template.id]}
                                            onTogglePin={togglePin}
                                            onSetPause={setPauseUntil}
                                            onSetTrial={setTrialEndsAt}
                                            onAssignBucket={handleAssignBucket}
                                            onCancel={(id) => setCancelTarget(id)}
                                            onRequestPriceUpdate={setUpdateTarget}
                                            onEdit={setEditTarget}
                                        />
                                    </motion.div>
                                ))}
                            </AnimatePresence>
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

            <EditSubscriptionDialog
                template={editTarget}
                onClose={() => setEditTarget(null)}
            />
        </>
    );
}
