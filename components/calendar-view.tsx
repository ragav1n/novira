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
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, RotateCw, Target, Tag, CalendarDays } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useBucketsList } from '@/components/providers/buckets-provider';
import { useWorkspaceTheme } from '@/hooks/useWorkspaceTheme';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getCategoryLabel, CATEGORY_COLORS } from '@/lib/categories';

type EventKind = 'recurring' | 'goal' | 'bucket-end';

interface CalendarEvent {
    id: string;
    date: Date;
    kind: EventKind;
    label: string;
    detail?: string;
    amount?: number;
    currency?: string;
    color?: string;
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
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(new Date()));

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

            const [{ data: recurringData }, { data: goalsData }] = await Promise.all([
                recurringQuery.returns<RecurringRow[]>(),
                goalsQuery.returns<GoalRow[]>(),
            ]);

            setRecurring(recurringData || []);
            setGoals(goalsData || []);
        } catch (error) {
            console.error('Error loading calendar data:', error);
        } finally {
            setLoading(false);
        }
    }, [userId, activeWorkspaceId]);

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
                date: d,
                kind: 'bucket-end',
                label: b.name,
                detail: 'Bucket ends',
                color: '#06B6D4',
            });
        }

        return out;
    }, [recurring, goals, buckets, viewMonth]);

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

    const selectedKey = format(selectedDate, 'yyyy-MM-dd');
    const selectedEvents = eventsByDay.get(selectedKey) || [];

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
                        <p className="text-xs text-muted-foreground mt-1">From recurring expenses, goal deadlines and bucket end-dates.</p>
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

                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setSelectedDate(day)}
                                    className={cn(
                                        'aspect-square rounded-xl flex flex-col items-center justify-center text-xs gap-0.5 border transition-colors relative p-1',
                                        inMonth ? 'text-foreground' : 'text-muted-foreground/40',
                                        isSelected
                                            ? `${themeConfig.bgMedium} ${themeConfig.borderMedium} ${themeConfig.text}`
                                            : 'bg-secondary/5 border-white/5 hover:bg-secondary/15',
                                        isToday && !isSelected && 'border-primary/40'
                                    )}
                                >
                                    <span className={cn('font-bold', isToday && 'text-primary')}>{format(day, 'd')}</span>
                                    {dayEvents.length > 0 && (
                                        <div className="flex items-center gap-0.5">
                                            {dayEvents.slice(0, 3).map((e, i) => (
                                                <span
                                                    key={i}
                                                    className="w-1 h-1 rounded-full"
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
                            <Popover>
                                <PopoverTrigger asChild>
                                    <button
                                        type="button"
                                        className={cn(
                                            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors',
                                            themeConfig.bgMedium, themeConfig.borderMedium, themeConfig.text, themeConfig.hoverBg
                                        )}
                                    >
                                        <Plus className="w-3 h-3" /> Schedule
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent
                                    align="end"
                                    sideOffset={6}
                                    className={cn(
                                        'w-56 p-1.5 bg-card/95 backdrop-blur-xl border-white/10 shadow-xl',
                                        // Tighter slide + faster duration overrides the default
                                        // popover's drawn-out slide-from-top-2 animation.
                                        'duration-150 ease-out',
                                        'data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1',
                                        'data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1'
                                    )}
                                >
                                    <button
                                        type="button"
                                        onClick={() => router.push(`/add?recurring=1&date=${format(selectedDate, 'yyyy-MM-dd')}`)}
                                        className="group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-left transition-all duration-150 hover:bg-primary/15 hover:translate-x-0.5"
                                    >
                                        <RotateCw className={cn('w-3.5 h-3.5 transition-transform duration-150 group-hover:scale-110 group-hover:rotate-45', themeConfig.text)} />
                                        <span className="flex-1 group-hover:text-foreground transition-colors">Recurring expense</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => router.push(`/groups?bucket=new&end=${format(selectedDate, 'yyyy-MM-dd')}`)}
                                        className="group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-left transition-all duration-150 hover:bg-cyan-500/15 hover:translate-x-0.5"
                                    >
                                        <Tag className="w-3.5 h-3.5 text-cyan-300 transition-transform duration-150 group-hover:scale-110" />
                                        <span className="flex-1 group-hover:text-foreground transition-colors">Bucket ending here</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => router.push(`/goals?goal=new&deadline=${format(selectedDate, 'yyyy-MM-dd')}`)}
                                        className="group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-left transition-all duration-150 hover:bg-emerald-500/15 hover:translate-x-0.5"
                                    >
                                        <Target className="w-3.5 h-3.5 text-emerald-300 transition-transform duration-150 group-hover:scale-110" />
                                        <span className="flex-1 group-hover:text-foreground transition-colors">Goal deadline</span>
                                    </button>
                                </PopoverContent>
                            </Popover>
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
                            const Icon = e.kind === 'recurring' ? RotateCw : e.kind === 'goal' ? Target : Tag;
                            return (
                                <div
                                    key={e.id}
                                    className="flex items-center gap-3 p-3 rounded-2xl bg-card/40 border border-white/5 backdrop-blur-sm"
                                >
                                    <div
                                        className="w-9 h-9 rounded-full flex items-center justify-center border"
                                        style={{
                                            background: `${e.color || '#8A2BE2'}20`,
                                            borderColor: `${e.color || '#8A2BE2'}40`,
                                        }}
                                    >
                                        <Icon className="w-4 h-4" style={{ color: e.color || '#8A2BE2' }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold truncate">{e.label}</p>
                                        {e.detail && (
                                            <p className="text-[11px] text-muted-foreground truncate">{e.detail}</p>
                                        )}
                                    </div>
                                    {e.amount != null && (
                                        <span className={cn('text-sm font-bold', e.amount < 0 ? 'text-rose-400' : themeConfig.text)}>
                                            {formatCurrency(e.amount, e.currency)}
                                        </span>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </motion.div>
    );
}
