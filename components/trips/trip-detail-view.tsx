'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { ArrowLeft, Calendar as CalendarIcon, MapPin, Edit2, Plane, Receipt, TrendingUp, Hash, Coins } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useActiveTrip } from '@/components/providers/active-trip-provider';
import { TripService } from '@/lib/services/trip-service';
import { TripForm } from '@/components/trips/trip-form';
import { supabase } from '@/lib/supabase';
import { CATEGORIES, CATEGORY_COLORS, getCategoryLabel } from '@/lib/categories';
import type { Trip } from '@/types/trip';
import { cn } from '@/lib/utils';

type TxRow = {
    id: string;
    amount: number;
    description: string;
    category: string;
    date: string;
    currency: string;
    base_currency?: string;
    exchange_rate?: number;
    converted_amount?: number;
};

export function TripDetailView({ tripId }: { tripId: string }) {
    const router = useRouter();
    const { userId, currency, formatCurrency, convertAmount } = useUserPreferences();
    const { refresh: refreshActiveTrip } = useActiveTrip();

    const [trip, setTrip] = useState<Trip | null>(null);
    const [transactions, setTransactions] = useState<TxRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [editOpen, setEditOpen] = useState(false);
    const [notFound, setNotFound] = useState(false);

    const load = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const t = await TripService.getTripById(tripId);
            if (!t) {
                setNotFound(true);
                setTrip(null);
                return;
            }
            setTrip(t);

            const { data, error } = await supabase
                .from('transactions')
                .select('id, amount, description, category, date, currency, base_currency, exchange_rate, converted_amount')
                .contains('tags', [t.slug])
                .order('date', { ascending: false })
                .limit(500);
            if (error) {
                console.error('[TripDetailView] tx fetch error', error);
                setTransactions([]);
            } else {
                setTransactions((data ?? []) as TxRow[]);
            }
        } finally {
            setLoading(false);
        }
    }, [tripId, userId]);

    useEffect(() => { load(); }, [load]);

    const tripCurrency = (trip?.home_currency || currency).toUpperCase();

    const toDisplay = useCallback((tx: TxRow): number => {
        const txCurr = (tx.currency || 'USD').toUpperCase();
        const baseCurr = (tx.base_currency || '').toUpperCase();
        if (txCurr === tripCurrency) return Number(tx.amount);
        if (tx.exchange_rate && baseCurr === tripCurrency) {
            return Number(tx.amount) * Number(tx.exchange_rate);
        }
        return convertAmount(Number(tx.amount), txCurr, tripCurrency);
    }, [tripCurrency, convertAmount]);

    const summary = useMemo(() => {
        if (!trip) return null;
        const total = transactions.reduce((acc, tx) => acc + toDisplay(tx), 0);
        const start = parseISO(trip.start_date);
        const end = parseISO(trip.end_date);
        const today = new Date();
        const todayStr = format(today, 'yyyy-MM-dd');
        const totalDays = Math.max(1, differenceInCalendarDays(end, start) + 1);
        const elapsed = Math.max(0, Math.min(totalDays, differenceInCalendarDays(today, start) + 1));
        // Compare via date strings so a same-day trip stays active for the whole
        // day (Date comparison would flip to false past local midnight when
        // `end` is at 00:00).
        const isActive = todayStr >= trip.start_date && todayStr <= trip.end_date;
        return { total, count: transactions.length, totalDays, elapsed, isActive };
    }, [trip, transactions, toDisplay]);

    const categoryBreakdown = useMemo(() => {
        const totals = new Map<string, number>();
        for (const tx of transactions) {
            const cat = tx.category || 'uncategorized';
            totals.set(cat, (totals.get(cat) ?? 0) + toDisplay(tx));
        }
        const arr = Array.from(totals.entries()).map(([cat, amount]) => ({ cat, amount }));
        arr.sort((a, b) => b.amount - a.amount);
        const max = arr[0]?.amount ?? 0;
        return arr.map(item => ({ ...item, share: max > 0 ? item.amount / max : 0 }));
    }, [transactions, toDisplay]);

    if (notFound) {
        return (
            <div className="flex flex-col min-h-screen p-5 max-w-md mx-auto items-center justify-center text-center gap-3">
                <Plane className="w-10 h-10 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-lg font-bold">Trip not found</h2>
                <Button variant="ghost" onClick={() => router.push('/trips')}>Back to trips</Button>
            </div>
        );
    }

    if (loading || !trip || !summary) {
        return (
            <div className="flex flex-col min-h-screen p-5 max-w-md mx-auto space-y-4 pb-24">
                <div className="h-10 w-32 bg-secondary/20 rounded-lg animate-pulse" />
                <div className="h-32 bg-secondary/10 rounded-3xl animate-pulse" />
                <div className="h-24 bg-secondary/10 rounded-3xl animate-pulse" />
            </div>
        );
    }

    const start = parseISO(trip.start_date);
    const end = parseISO(trip.end_date);

    return (
        <div className="flex flex-col min-h-screen p-5 max-w-md mx-auto space-y-5 pb-32">
            <div className="flex items-center justify-between pt-2 gap-3">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push('/trips')}
                    aria-label="Back to trips"
                    className="rounded-full w-10 h-10"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <h1 className="text-lg font-bold truncate flex-1 text-center">{trip.name}</h1>
                <Button size="icon" variant="ghost" onClick={() => setEditOpen(true)} aria-label="Edit trip" className="rounded-full w-10 h-10">
                    <Edit2 className="w-4 h-4" />
                </Button>
            </div>

            <Card className="bg-card/40 border-white/5 backdrop-blur-xl">
                <CardContent className="p-5 space-y-3">
                    <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3" aria-hidden="true" />
                            {format(start, 'MMM d')} – {format(end, 'MMM d, yyyy')}
                        </span>
                        {trip.base_location && (
                            <span className="inline-flex items-center gap-1">
                                <MapPin className="w-3 h-3" aria-hidden="true" />
                                {trip.base_location}
                            </span>
                        )}
                        {trip.home_currency && trip.home_currency.toUpperCase() !== currency.toUpperCase() && (
                            <span className="inline-flex items-center gap-1">
                                <Coins className="w-3 h-3" aria-hidden="true" />
                                {trip.home_currency.toUpperCase()}
                            </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                            <Hash className="w-3 h-3" aria-hidden="true" />
                            {trip.slug}
                        </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <Kpi
                            icon={<TrendingUp className="w-3.5 h-3.5 text-sky-300" />}
                            label="Total"
                            value={formatCurrency(summary.total, tripCurrency)}
                        />
                        <Kpi
                            icon={<Receipt className="w-3.5 h-3.5 text-sky-300" />}
                            label="Txns"
                            value={`${summary.count}`}
                        />
                        <Kpi
                            icon={<CalendarIcon className="w-3.5 h-3.5 text-sky-300" />}
                            label="Days"
                            value={summary.isActive ? `${summary.elapsed}/${summary.totalDays}` : `${summary.totalDays}`}
                        />
                    </div>
                </CardContent>
            </Card>

            {categoryBreakdown.length > 0 && (
                <section className="space-y-2">
                    <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold px-1">
                        By category
                    </h2>
                    <Card className="bg-card/40 border-white/5 backdrop-blur-xl">
                        <CardContent className="p-4 space-y-2.5">
                            {categoryBreakdown.slice(0, 8).map(({ cat, amount, share }) => {
                                const label = getCategoryLabel(cat);
                                const swatch = CATEGORY_COLORS[cat as keyof typeof CATEGORY_COLORS] ?? '#64748b';
                                return (
                                    <div key={cat} className="space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-foreground">{label}</span>
                                            <span className="text-muted-foreground tabular-nums">{formatCurrency(amount, tripCurrency)}</span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-black/30 overflow-hidden">
                                            <div
                                                className="h-full rounded-full"
                                                style={{ width: `${Math.max(2, share * 100)}%`, background: swatch }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
                </section>
            )}

            {transactions.length > 0 ? (
                <section className="space-y-2">
                    <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold px-1">
                        Transactions
                    </h2>
                    <div className="space-y-1.5">
                        {transactions.slice(0, 50).map(tx => (
                            <Card key={tx.id} className="bg-card/40 border-white/5">
                                <CardContent className="p-3 flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium truncate">{tx.description}</p>
                                        <p className="text-[11px] text-muted-foreground">
                                            {format(parseISO(tx.date.slice(0, 10)), 'MMM d')} · {getCategoryLabel(tx.category)}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-sm font-bold tabular-nums">{formatCurrency(toDisplay(tx), tripCurrency)}</p>
                                        {(tx.currency || 'USD').toUpperCase() !== tripCurrency && (
                                            <p className="text-[10px] text-muted-foreground">
                                                {formatCurrency(Number(tx.amount), tx.currency)}
                                            </p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                        {transactions.length > 50 && (
                            <p className="text-[11px] text-muted-foreground text-center pt-2">
                                Showing first 50 of {transactions.length}.
                            </p>
                        )}
                    </div>
                </section>
            ) : (
                <Card className="bg-card/40 border-white/5">
                    <CardContent className="p-6 text-center text-sm text-muted-foreground">
                        No transactions tagged with <code className="text-foreground">{trip.slug}</code> yet.
                    </CardContent>
                </Card>
            )}

            <TripForm
                open={editOpen}
                onOpenChange={setEditOpen}
                editing={trip}
                onSaved={() => { load(); refreshActiveTrip(); }}
            />
        </div>
    );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="rounded-2xl bg-secondary/10 border border-white/5 p-2.5">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                {icon}
                <span className="truncate">{label}</span>
            </div>
            <p className={cn('text-sm font-bold mt-0.5 truncate')}>{value}</p>
        </div>
    );
}
