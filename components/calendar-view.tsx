'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    addDays,
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isSameDay,
    isSameMonth,
    parseISO,
    startOfDay,
    startOfMonth,
    startOfWeek,
    subMonths,
} from 'date-fns';
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, RotateCw, Target, Tag, CalendarDays, Bell, TrendingDown, Check, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useBucketsList } from '@/components/providers/buckets-provider';
import { useWorkspaceTheme } from '@/hooks/useWorkspaceTheme';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { getCategoryLabel, CATEGORY_COLORS } from '@/lib/categories';
import { ScheduleSheet } from '@/components/calendar/schedule-sheet';
import { toast } from '@/utils/haptics';

type EventKind = 'recurring' | 'goal' | 'bucket-end' | 'one-off';

interface CalendarEvent {
    id: string;
    sourceId: string;
    date: Date;
    kind: EventKind;
    label: string;
    detail?: string;
    amount?: number;
    currency?: string;
    color?: string;
    isCompleted?: boolean;
}

interface RecurringRow {
    id: string;
    description: string;
    amount: number;
    currency: string;
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    next_occurrence: string;
    category: string;
    is_active: boolean;
}

interface GoalRow {
    id: string;
    name: string;
    target_amount: number;
    current_amount: number;
    currency: string;
    deadline: string | null;
}

interface OneOffRow {
    id: string;
    date: string;
    label: string;
    amount: number | null;
    currency: string | null;
    notes: string | null;
    is_completed: boolean;
}

function expandRecurring(row: RecurringRow, fromStr: string, untilStr: string): Date[] {
    const out: Date[] = [];
    const from = parseISO(fromStr);
    const until = parseISO(untilStr);
    let cursor = parseISO(row.next_occurrence);
    // Fast-forward past stale next_occurrence values so the safety cap can't
    // exhaust before reaching the visible window.
    if (cursor < from) {
        const stepDays = row.frequency === 'daily' ? 1
            : row.frequency === 'weekly' ? 7
            : row.frequency === 'monthly' ? 30
            : 365;
        const diffDays = Math.floor((from.getTime() - cursor.getTime()) / (24 * 60 * 60 * 1000));
        const skipSteps = Math.floor(diffDays / stepDays);
        if (skipSteps > 0) {
            switch (row.frequency) {
                case 'daily': cursor = addDays(cursor, skipSteps); break;
                case 'weekly': cursor = addDays(cursor, skipSteps * 7); break;
                case 'monthly': cursor = addMonths(cursor, skipSteps); break;
                case 'yearly': cursor = addMonths(cursor, skipSteps * 12); break;
            }
        }
    }
    let safety = 0;
    while (cursor <= until && safety < 200) {
        if (cursor >= from) out.push(cursor);
        switch (row.frequency) {
            case 'daily': cursor = addDays(cursor, 1); break;
            case 'weekly': cursor = addDays(cursor, 7); break;
            case 'monthly': cursor = addMonths(cursor, 1); break;
            case 'yearly': cursor = addMonths(cursor, 12); break;
        }
        safety++;
    }
    return out;
}

export function CalendarView() {
    const router = useRouter();
    const { userId, formatCurrency, convertAmount, currency, activeWorkspaceId } = useUserPreferences();
    const { theme: themeConfig } = useWorkspaceTheme();
    const { buckets } = useBucketsList();

    const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
    const [recurring, setRecurring] = useState<RecurringRow[]>([]);
    const [goals, setGoals] = useState<GoalRow[]>([]);
    const [oneOffs, setOneOffs] = useState<OneOffRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(new Date()));
    const [scheduleOpen, setScheduleOpen] = useState(false);

    const load = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try {
            let recurringQuery = supabase
                .from('recurring_templates')
                .select('id, description, amount, currency, frequency, next_occurrence, category, is_active')
                .eq('user_id', userId)
                .eq('is_active', true);
            if (activeWorkspaceId && activeWorkspaceId !== 'personal') {
                recurringQuery = recurringQuery.eq('group_id', activeWorkspaceId);
            } else if (activeWorkspaceId === 'personal') {
                recurringQuery = recurringQuery.is('group_id', null);
            }

            const goalsQuery = supabase
                .from('savings_goals')
                .select('id, name, target_amount, current_amount, currency, deadline')
                .eq('user_id', userId)
                .not('deadline', 'is', null);

            // Bound the one-off window so the table stays cheap to query as it grows.
            const oneOffStart = format(subMonths(viewMonth, 1), 'yyyy-MM-dd');
            const oneOffEnd = format(addMonths(viewMonth, 2), 'yyyy-MM-dd');
            let oneOffQuery = supabase
                .from('scheduled_events')
                .select('id, date, label, amount, currency, notes, is_completed')
                .eq('user_id', userId)
                .gte('date', oneOffStart)
                .lte('date', oneOffEnd);
            if (activeWorkspaceId && activeWorkspaceId !== 'personal') {
                oneOffQuery = oneOffQuery.eq('group_id', activeWorkspaceId);
            } else if (activeWorkspaceId === 'personal') {
                oneOffQuery = oneOffQuery.is('group_id', null);
            }

            const [{ data: recurringData }, { data: goalsData }, { data: oneOffData, error: oneOffError }] = await Promise.all([
                recurringQuery.returns<RecurringRow[]>(),
                goalsQuery.returns<GoalRow[]>(),
                oneOffQuery.returns<OneOffRow[]>(),
            ]);

            if (oneOffError && oneOffError.code !== '42P01') {
                // 42P01 = "relation does not exist" — surfaces if the migration hasn't been
                // applied yet. Fail soft so the rest of the page still renders.
                console.error('Error loading scheduled_events:', oneOffError);
            }

            setRecurring(recurringData || []);
            setGoals(goalsData || []);
            setOneOffs(oneOffData || []);
        } catch (error) {
            console.error('Error loading calendar data:', error);
        } finally {
            setLoading(false);
        }
    }, [userId, activeWorkspaceId, viewMonth]);

    useEffect(() => { load(); }, [load]);

    // Build events for the visible month + a 60-day forward window so day-detail
    // works for buckets / goals whose dates fall within either range.
    const events = useMemo<CalendarEvent[]>(() => {
        const horizonStart = startOfWeek(viewMonth);
        const horizonEnd = endOfWeek(endOfMonth(viewMonth));
        const horizonStartStr = format(horizonStart, 'yyyy-MM-dd');
        const horizonEndStr = format(horizonEnd, 'yyyy-MM-dd');
        const out: CalendarEvent[] = [];

        for (const r of recurring) {
            const dates = expandRecurring(r, horizonStartStr, horizonEndStr);
            for (const d of dates) {
                out.push({
                    id: `r-${r.id}-${format(d, 'yyyyMMdd')}`,
                    sourceId: r.id,
                    date: d,
                    kind: 'recurring',
                    label: r.description,
                    detail: getCategoryLabel(r.category),
                    amount: -Math.abs(Number(r.amount)),
                    currency: r.currency,
                    color: CATEGORY_COLORS[r.category] || CATEGORY_COLORS.others,
                });
            }
        }

        for (const g of goals) {
            if (!g.deadline) continue;
            const d = parseISO(g.deadline);
            if (d < horizonStart || d > horizonEnd) continue;
            const remaining = Math.max(Number(g.target_amount) - Number(g.current_amount), 0);
            out.push({
                id: `g-${g.id}`,
                sourceId: g.id,
                date: d,
                kind: 'goal',
                label: g.name,
                detail: 'Goal deadline',
                amount: -remaining,
                currency: g.currency,
                color: '#10B981',
            });
        }

        for (const b of buckets) {
            if (!b.end_date || b.is_archived) continue;
            const d = parseISO(b.end_date);
            if (d < horizonStart || d > horizonEnd) continue;
            out.push({
                id: `b-${b.id}`,
                sourceId: b.id,
                date: d,
                kind: 'bucket-end',
                label: b.name,
                detail: 'Bucket ends',
                amount: b.budget != null ? -Math.abs(Number(b.budget)) : undefined,
                currency: b.currency,
                color: '#06B6D4',
            });
        }

        for (const o of oneOffs) {
            const d = parseISO(o.date);
            if (d < horizonStart || d > horizonEnd) continue;
            out.push({
                id: `o-${o.id}`,
                sourceId: o.id,
                date: d,
                kind: 'one-off',
                label: o.label,
                detail: o.is_completed ? 'Completed' : (o.notes || (o.amount != null ? 'One-off bill' : 'Reminder')),
                amount: o.amount != null ? -Math.abs(Number(o.amount)) : undefined,
                currency: o.currency || currency,
                color: '#F59E0B',
                isCompleted: o.is_completed,
            });
        }

        return out;
    }, [recurring, goals, buckets, oneOffs, viewMonth, currency]);

    const eventsByDay = useMemo(() => {
        const map = new Map<string, CalendarEvent[]>();
        for (const e of events) {
            const key = format(e.date, 'yyyy-MM-dd');
            const arr = map.get(key) || [];
            arr.push(e);
            map.set(key, arr);
        }
        return map;
    }, [events]);

    const dailyDelta = useMemo(() => {
        const map = new Map<string, number>();
        for (const e of events) {
            if (e.amount == null) continue;
            // Bucket-ends are deadline markers, not actual cash debits — the real
            // spending inside the bucket already shows up as transactions. Skip them
            // so the projected total stays meaningful.
            if (e.kind === 'bucket-end') continue;
            // Completed one-offs no longer represent future obligations.
            if (e.kind === 'one-off' && e.isCompleted) continue;
            const key = format(e.date, 'yyyy-MM-dd');
            const inBase = convertAmount(e.amount, e.currency || currency, currency);
            map.set(key, (map.get(key) || 0) + inBase);
        }
        return map;
    }, [events, convertAmount, currency]);

    const days = useMemo(() => {
        const start = startOfWeek(viewMonth);
        const end = endOfWeek(endOfMonth(viewMonth));
        return eachDayOfInterval({ start, end });
    }, [viewMonth]);

    const monthlyTotal = useMemo(() => {
        let sum = 0;
        for (const [key, val] of dailyDelta.entries()) {
            const d = parseISO(key);
            if (isSameMonth(d, viewMonth)) sum += val;
        }
        return sum;
    }, [dailyDelta, viewMonth]);

    const maxAbsDeltaInMonth = useMemo(() => {
        let max = 0;
        for (const [key, val] of dailyDelta.entries()) {
            if (!isSameMonth(parseISO(key), viewMonth)) continue;
            if (Math.abs(val) > max) max = Math.abs(val);
        }
        return max;
    }, [dailyDelta, viewMonth]);

    // Walks the visible month day-by-day, accumulating outflows, and tracks the
    // single day where the running total dips lowest. That's the date the user
    // needs the most cash on hand.
    const tightestDay = useMemo(() => {
        const monthDays = eachDayOfInterval({
            start: startOfMonth(viewMonth),
            end: endOfMonth(viewMonth),
        });
        let cumulative = 0;
        let worstDay: Date | null = null;
        let worstAmount = 0;
        for (const d of monthDays) {
            const key = format(d, 'yyyy-MM-dd');
            cumulative += dailyDelta.get(key) || 0;
            if (cumulative < worstAmount) {
                worstAmount = cumulative;
                worstDay = d;
            }
        }
        return worstAmount < 0 && worstDay
            ? { date: worstDay, cumulative: worstAmount }
            : null;
    }, [dailyDelta, viewMonth]);

    const selectedKey = format(selectedDate, 'yyyy-MM-dd');
    const selectedEvents = eventsByDay.get(selectedKey) || [];

    const handleToggleOneOff = useCallback(async (id: string, completed: boolean) => {
        const prev = oneOffs;
        setOneOffs(prev.map(o => o.id === id ? { ...o, is_completed: completed } : o));
        try {
            const { error } = await supabase
                .from('scheduled_events')
                .update({ is_completed: completed })
                .eq('id', id);
            if (error) throw error;
        } catch (err) {
            console.error('Error toggling one-off:', err);
            setOneOffs(prev);
            toast.error('Could not update');
        }
    }, [oneOffs]);

    const handleDeleteOneOff = useCallback(async (id: string) => {
        const prev = oneOffs;
        setOneOffs(prev.filter(o => o.id !== id));
        try {
            const { error } = await supabase.from('scheduled_events').delete().eq('id', id);
            if (error) throw error;
            toast.success('Removed');
        } catch (err) {
            console.error('Error deleting one-off:', err);
            setOneOffs(prev);
            toast.error('Could not delete');
        }
    }, [oneOffs]);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 220, damping: 28, mass: 0.9 }}
            className="relative min-h-[100dvh] w-full"
        >
            <div className="p-5 space-y-5 max-w-md lg:max-w-2xl mx-auto relative pb-24 lg:pb-8 z-10">
                <div className="flex items-center justify-between relative min-h-[40px]">
                    <button
                        onClick={() => router.back()}
                        aria-label="Go back"
                        className="w-10 h-10 rounded-full bg-secondary/30 hover:bg-secondary/50 flex items-center justify-center transition-colors shrink-0 z-10"
                    >
                        <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                    </button>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <h1 className="text-lg font-semibold flex items-center gap-2">
                            <CalendarDays className={`w-5 h-5 ${themeConfig.text}`} />
                            Cash Flow
                        </h1>
                    </div>
                    <div className="w-10 shrink-0" />
                </div>

                <Card className={cn('bg-gradient-to-br backdrop-blur-md', themeConfig.gradient, themeConfig.border)}>
                    <CardContent className="p-5">
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                            {format(viewMonth, 'MMMM yyyy')} projected
                        </p>
                        <h2 className={cn('text-3xl font-bold mt-1', monthlyTotal < 0 ? 'text-rose-400' : themeConfig.text)}>
                            {monthlyTotal >= 0 ? '+' : ''}{formatCurrency(monthlyTotal)}
                        </h2>
                        <p className="text-xs text-muted-foreground mt-1">From recurring expenses, goal deadlines and one-off bills.</p>
                        {tightestDay && (
                            <button
                                type="button"
                                onClick={() => setSelectedDate(tightestDay.date)}
                                className="mt-3 pt-3 border-t border-white/5 w-full flex items-center gap-2 text-[11px] text-left rounded-md hover:bg-white/5 -mx-1 px-1 py-1 transition-colors"
                            >
                                <TrendingDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                <span className="text-muted-foreground">Tightest day:</span>
                                <span className="font-bold">{format(tightestDay.date, 'MMM d')}</span>
                                <span className="text-rose-400 font-bold ml-auto">
                                    {formatCurrency(tightestDay.cumulative)}
                                </span>
                            </button>
                        )}
                    </CardContent>
                </Card>

                <div className="bg-card/40 border border-white/5 rounded-3xl p-3 backdrop-blur-sm">
                    <div className="flex items-center justify-between px-2 py-1">
                        <button
                            onClick={() => setViewMonth(prev => subMonths(prev, 1))}
                            aria-label="Previous month"
                            className="w-8 h-8 rounded-full bg-secondary/20 hover:bg-secondary/40 flex items-center justify-center"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <p className="text-sm font-semibold">{format(viewMonth, 'MMMM yyyy')}</p>
                        <button
                            onClick={() => setViewMonth(prev => addMonths(prev, 1))}
                            aria-label="Next month"
                            className="w-8 h-8 rounded-full bg-secondary/20 hover:bg-secondary/40 flex items-center justify-center"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 mt-2 text-center text-[10px] uppercase font-bold text-muted-foreground">
                        {['S','M','T','W','T','F','S'].map((d, i) => <div key={i}>{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1 mt-1">
                        {days.map(day => {
                            const key = format(day, 'yyyy-MM-dd');
                            const inMonth = isSameMonth(day, viewMonth);
                            const dayEvents = eventsByDay.get(key) || [];
                            const delta = dailyDelta.get(key) || 0;
                            const isSelected = isSameDay(day, selectedDate);
                            const isToday = isSameDay(day, new Date());
                            // Saturate the cell by relative outflow magnitude so big-spend
                            // days pop. Selected cell wins (theme highlight overrides tint).
                            const intensity = (!isSelected && delta < 0 && inMonth && maxAbsDeltaInMonth > 0)
                                ? Math.abs(delta) / maxAbsDeltaInMonth
                                : 0;
                            const heatmapStyle = intensity > 0
                                ? { background: `rgba(244, 63, 94, ${0.06 + intensity * 0.22})` }
                                : undefined;

                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setSelectedDate(day)}
                                    style={heatmapStyle}
                                    className={cn(
                                        'aspect-square rounded-xl flex flex-col items-center justify-center text-xs gap-0.5 border transition-colors relative p-1',
                                        inMonth ? 'text-foreground' : 'text-muted-foreground/40',
                                        isSelected
                                            ? `${themeConfig.bgMedium} ${themeConfig.borderMedium} ${themeConfig.text}`
                                            : intensity === 0 && 'bg-secondary/5 hover:bg-secondary/15',
                                        !isSelected && 'border-white/5',
                                        isToday && !isSelected && 'border-primary/40'
                                    )}
                                >
                                    <span className={cn('font-bold', isToday && 'text-primary')}>{format(day, 'd')}</span>
                                    {dayEvents.length > 0 && (
                                        <div className="flex items-center gap-0.5">
                                            {dayEvents.slice(0, 3).map((e, i) => (
                                                <span
                                                    key={i}
                                                    className={cn('w-1 h-1 rounded-full', e.isCompleted && 'opacity-30')}
                                                    style={{ background: e.color || '#888' }}
                                                />
                                            ))}
                                            {dayEvents.length > 3 && <span className="w-1 h-1 rounded-full bg-white/40" />}
                                        </div>
                                    )}
                                    {delta < 0 && inMonth && (
                                        <span className="text-[9px] font-semibold text-rose-400/80 leading-none">
                                            {formatCurrency(delta)}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold">{format(selectedDate, 'EEEE, MMM d')}</h3>
                        <div className="flex items-center gap-2">
                            {selectedEvents.length > 0 && (
                                <span className="text-[11px] text-muted-foreground font-medium">
                                    {selectedEvents.length} item{selectedEvents.length === 1 ? '' : 's'}
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={() => setScheduleOpen(true)}
                                className={cn(
                                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors',
                                    themeConfig.bgMedium, themeConfig.borderMedium, themeConfig.text, themeConfig.hoverBg
                                )}
                            >
                                <Plus className="w-3 h-3" /> Schedule
                            </button>
                        </div>
                    </div>
                    {loading ? (
                        <div className="space-y-2">
                            <div className="h-14 rounded-2xl bg-secondary/10 animate-pulse" />
                            <div className="h-14 rounded-2xl bg-secondary/10 animate-pulse" />
                        </div>
                    ) : selectedEvents.length === 0 ? (
                        <div className="text-center py-8 border border-dashed border-white/10 rounded-2xl text-muted-foreground text-xs">
                            Nothing scheduled.
                        </div>
                    ) : (
                        selectedEvents.map(e => {
                            const Icon = e.kind === 'recurring' ? RotateCw
                                : e.kind === 'goal' ? Target
                                : e.kind === 'one-off' ? Bell
                                : Tag;
                            const isOneOff = e.kind === 'one-off';
                            return (
                                <div
                                    key={e.id}
                                    className={cn(
                                        'flex items-center gap-3 p-3 rounded-2xl bg-card/40 border border-white/5 backdrop-blur-sm',
                                        e.isCompleted && 'opacity-50'
                                    )}
                                >
                                    <div
                                        className="w-9 h-9 rounded-full flex items-center justify-center border shrink-0"
                                        style={{
                                            background: `${e.color || '#8A2BE2'}20`,
                                            borderColor: `${e.color || '#8A2BE2'}40`,
                                        }}
                                    >
                                        <Icon className="w-4 h-4" style={{ color: e.color || '#8A2BE2' }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={cn('text-sm font-semibold truncate', e.isCompleted && 'line-through')}>{e.label}</p>
                                        {e.detail && (
                                            <p className="text-[11px] text-muted-foreground truncate">{e.detail}</p>
                                        )}
                                    </div>
                                    {e.amount != null && (
                                        <span className={cn('text-sm font-bold', e.amount < 0 ? 'text-rose-400' : themeConfig.text)}>
                                            {formatCurrency(e.amount, e.currency)}
                                        </span>
                                    )}
                                    {isOneOff && (
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleOneOff(e.sourceId, !e.isCompleted)}
                                                aria-label={e.isCompleted ? 'Mark as not completed' : 'Mark as completed'}
                                                className={cn(
                                                    'w-7 h-7 rounded-full flex items-center justify-center border transition-colors',
                                                    e.isCompleted
                                                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                                        : 'bg-secondary/20 border-white/10 text-muted-foreground hover:bg-secondary/40'
                                                )}
                                            >
                                                <Check className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteOneOff(e.sourceId)}
                                                aria-label="Delete one-off"
                                                className="w-7 h-7 rounded-full flex items-center justify-center border bg-secondary/20 border-white/10 text-muted-foreground hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <ScheduleSheet
                open={scheduleOpen}
                onOpenChange={setScheduleOpen}
                selectedDate={selectedDate}
                onCreated={load}
            />
        </motion.div>
    );
}
