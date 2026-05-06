'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, X, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from '@/utils/haptics';
import {
    detectRecurringCandidates,
    loadDismissedKeys,
    dismissCandidate,
    type RecurringCandidate,
} from '@/lib/recurring-detect';
import type { Transaction, RecurringTemplate } from '@/types/transaction';
import { getCategoryLabel } from '@/lib/categories';

interface Props {
    userId: string | null | undefined;
    activeWorkspaceId: string | 'personal' | null;
    templates: RecurringTemplate[];
    formatCurrency: (amount: number, currency?: string) => string;
    onCreated: () => void;
}

const FREQ_LABEL: Record<RecurringCandidate['frequency'], string> = {
    daily: 'daily',
    weekly: 'weekly',
    monthly: 'monthly',
    yearly: 'yearly',
};

export function RecurringDetectCard({
    userId,
    activeWorkspaceId,
    templates,
    formatCurrency,
    onCreated,
}: Props) {
    const [candidates, setCandidates] = useState<RecurringCandidate[]>([]);
    const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => loadDismissedKeys());
    const [creatingKey, setCreatingKey] = useState<string | null>(null);

    useEffect(() => {
        if (!userId) {
            setCandidates([]);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const ninetyDaysAgo = new Date();
                ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
                const since = ninetyDaysAgo.toISOString().slice(0, 10);

                let q = supabase
                    .from('transactions')
                    .select('id, description, amount, category, date, payment_method, currency, is_recurring, is_settlement, user_id, created_at, group_id')
                    .eq('user_id', userId)
                    .eq('is_recurring', false)
                    .gte('date', since)
                    .order('date', { ascending: false })
                    .limit(500);

                if (activeWorkspaceId && activeWorkspaceId !== 'personal') {
                    q = q.eq('group_id', activeWorkspaceId);
                } else if (activeWorkspaceId === 'personal') {
                    q = q.is('group_id', null);
                }

                const { data, error } = await q;
                if (error) throw error;
                if (cancelled) return;

                const result = detectRecurringCandidates(
                    (data ?? []) as Transaction[],
                    templates,
                    { dismissedKeys, maxResults: 5 },
                );
                setCandidates(result);
            } catch (error) {
                console.error('Recurring detection failed:', error);
            }
        })();
        return () => { cancelled = true; };
    }, [userId, activeWorkspaceId, templates, dismissedKeys]);

    const visible = useMemo(
        () => candidates.filter((c) => !dismissedKeys.has(c.normalizedKey)),
        [candidates, dismissedKeys],
    );

    const handleDismiss = (key: string) => {
        dismissCandidate(key);
        setDismissedKeys((prev) => new Set([...prev, key]));
    };

    const handleCreate = async (c: RecurringCandidate) => {
        if (!userId) return;
        setCreatingKey(c.normalizedKey);
        try {
            const insert: Record<string, unknown> = {
                user_id: userId,
                description: c.description,
                amount: c.meanAmount,
                currency: c.currency,
                frequency: c.frequency,
                category: c.category,
                payment_method: c.payment_method,
                next_occurrence: c.nextEstimatedDate,
                is_active: true,
            };
            if (activeWorkspaceId && activeWorkspaceId !== 'personal') {
                insert.group_id = activeWorkspaceId;
            }
            const { error } = await supabase
                .from('recurring_templates')
                .insert(insert);
            if (error) throw error;
            toast.success(`Tracking "${c.description}" as a recurring expense`);
            handleDismiss(c.normalizedKey);
            onCreated();
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            toast.error('Failed to create recurring template: ' + msg);
        } finally {
            setCreatingKey(null);
        }
    };

    if (visible.length === 0) return null;

    return (
        <Card className="bg-gradient-to-br from-amber-500/10 to-rose-500/5 border-amber-500/20 backdrop-blur-md">
            <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" aria-hidden="true" />
                    <h3 className="text-sm font-semibold">
                        Possible subscriptions detected
                    </h3>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                        Last 90 days
                    </span>
                </div>
                <p className="text-[11px] text-muted-foreground -mt-1">
                    These look like recurring charges. Track them so they show up in your subscriptions.
                </p>
                <div className="space-y-2">
                    {visible.map((c) => (
                        <div
                            key={c.normalizedKey}
                            className="flex items-center gap-3 rounded-xl bg-card/40 border border-white/5 p-3"
                        >
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate capitalize">{c.description}</p>
                                <p className="text-[11px] text-muted-foreground">
                                    {formatCurrency(c.meanAmount, c.currency)} · {FREQ_LABEL[c.frequency]}
                                    <span className="opacity-60"> · {getCategoryLabel(c.category)}</span>
                                    <span className="opacity-60"> · {c.occurrences}× </span>
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={creatingKey === c.normalizedKey}
                                onClick={() => handleCreate(c)}
                                className="h-8 px-2.5 text-[11px] gap-1 border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                            >
                                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                                {creatingKey === c.normalizedKey ? '...' : 'Track'}
                            </Button>
                            <button
                                type="button"
                                onClick={() => handleDismiss(c.normalizedKey)}
                                className="w-7 h-7 rounded-full hover:bg-secondary/30 flex items-center justify-center text-muted-foreground hover:text-foreground"
                                aria-label={`Dismiss ${c.description}`}
                            >
                                <X className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
