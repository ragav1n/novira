'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { Plane, Plus, Calendar as CalendarIcon, MapPin, Edit2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useActiveTrip } from '@/components/providers/active-trip-provider';
import { TripService } from '@/lib/services/trip-service';
import { TripForm } from '@/components/trips/trip-form';
import { supabase } from '@/lib/supabase';
import type { Trip } from '@/types/trip';

type Bucket = 'active' | 'upcoming' | 'past';

function bucketOf(trip: Trip): Bucket {
    const today = format(new Date(), 'yyyy-MM-dd');
    if (trip.start_date > today) return 'upcoming';
    if (trip.end_date < today) return 'past';
    return 'active';
}

export function TripsTabContent() {
    const { userId, activeWorkspaceId, formatCurrency, currency, convertAmount } = useUserPreferences();
    const { refresh: refreshActiveTrip } = useActiveTrip();
    const [trips, setTrips] = useState<Trip[]>([]);
    const [loading, setLoading] = useState(true);
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<Trip | null>(null);
    const [tripTotals, setTripTotals] = useState<Record<string, number>>({});
    const fetchGenRef = useRef(0);

    const load = useCallback(async () => {
        if (!userId) return;
        const myGen = ++fetchGenRef.current;
        setLoading(true);
        try {
            const list = await TripService.getTripsForUser(userId, activeWorkspaceId);
            if (fetchGenRef.current !== myGen) return;
            setTrips(list);

            if (list.length === 0) {
                setTripTotals({});
                return;
            }

            const slugs = list.map(t => t.slug);
            const tripCurrencyBySlug = new Map<string, string>(
                list.map(t => [t.slug, (t.home_currency || currency).toUpperCase()])
            );
            const query = supabase
                .from('transactions')
                .select('amount, currency, exchange_rate, base_currency, converted_amount, tags');
            const q = activeWorkspaceId
                ? query.eq('group_id', activeWorkspaceId)
                : query.eq('user_id', userId).is('group_id', null);
            const { data, error } = await q.overlaps('tags', slugs);
            if (error || !data || fetchGenRef.current !== myGen) {
                if (error) console.error('[TripsTabContent] tx fetch error', error);
                return;
            }

            const totals: Record<string, number> = {};
            for (const tx of data as Array<{
                amount: number; currency: string; exchange_rate?: number;
                base_currency?: string; converted_amount?: number; tags?: string[];
            }>) {
                const txCurr = (tx.currency || 'USD').toUpperCase();
                const baseCurr = (tx.base_currency || '').toUpperCase();
                for (const tag of tx.tags ?? []) {
                    if (!slugs.includes(tag)) continue;
                    const target = tripCurrencyBySlug.get(tag) ?? currency.toUpperCase();
                    let amountInTarget: number;
                    if (txCurr === target) {
                        amountInTarget = Number(tx.amount);
                    } else if (tx.exchange_rate && baseCurr === target) {
                        amountInTarget = Number(tx.amount) * Number(tx.exchange_rate);
                    } else {
                        amountInTarget = convertAmount(Number(tx.amount), txCurr, target);
                    }
                    totals[tag] = (totals[tag] ?? 0) + amountInTarget;
                }
            }
            setTripTotals(totals);
        } catch (e) {
            console.error('[TripsTabContent] load failed', e);
        } finally {
            if (fetchGenRef.current === myGen) setLoading(false);
        }
    }, [userId, activeWorkspaceId, currency, convertAmount]);

    useEffect(() => { load(); }, [load]);

    const grouped = useMemo(() => {
        const out: Record<Bucket, Trip[]> = { active: [], upcoming: [], past: [] };
        for (const t of trips) out[bucketOf(t)].push(t);
        out.upcoming.sort((a, b) => a.start_date.localeCompare(b.start_date));
        return out;
    }, [trips]);

    const openCreate = () => { setEditing(null); setFormOpen(true); };
    const openEdit = (trip: Trip) => { setEditing(trip); setFormOpen(true); };

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={openCreate}
                    disabled={loading}
                    className="text-sky-300 hover:text-sky-200 hover:bg-sky-500/10 disabled:opacity-50 rounded-full px-3"
                    aria-label="New trip"
                >
                    <Plus className="w-4 h-4 mr-1" /> New trip
                </Button>
            </div>

            {loading ? (
                <div className="space-y-3">
                    <div className="h-24 rounded-3xl bg-secondary/10 animate-pulse" />
                    <div className="h-24 rounded-3xl bg-secondary/10 animate-pulse" />
                </div>
            ) : trips.length === 0 ? (
                <EmptyState onCreate={openCreate} />
            ) : (
                <>
                    <Section title="Active" trips={grouped.active} totals={tripTotals} formatCurrency={formatCurrency} onEdit={openEdit} />
                    <Section title="Upcoming" trips={grouped.upcoming} totals={tripTotals} formatCurrency={formatCurrency} onEdit={openEdit} />
                    <Section title="Past" trips={grouped.past} totals={tripTotals} formatCurrency={formatCurrency} onEdit={openEdit} />
                </>
            )}

            <TripForm
                open={formOpen}
                onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }}
                editing={editing}
                onSaved={() => { load(); refreshActiveTrip(); }}
            />
        </div>
    );
}

function Section({
    title, trips, totals, formatCurrency, onEdit,
}: {
    title: string;
    trips: Trip[];
    totals: Record<string, number>;
    formatCurrency: (amount: number, currencyOverride?: string) => string;
    onEdit: (t: Trip) => void;
}) {
    if (trips.length === 0) return null;
    return (
        <section className="space-y-2">
            <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold px-1">
                {title}
            </h2>
            <div className="space-y-3">
                {trips.map(t => (
                    <TripCard
                        key={t.id}
                        trip={t}
                        total={totals[t.slug] ?? 0}
                        formatCurrency={formatCurrency}
                        onEdit={onEdit}
                    />
                ))}
            </div>
        </section>
    );
}

function TripCard({
    trip, total, formatCurrency, onEdit,
}: {
    trip: Trip;
    total: number;
    formatCurrency: (amount: number, currencyOverride?: string) => string;
    onEdit: (t: Trip) => void;
}) {
    const start = parseISO(trip.start_date);
    const end = parseISO(trip.end_date);
    const today = new Date();
    const totalDays = Math.max(1, differenceInCalendarDays(end, start) + 1);
    const elapsed = Math.max(0, Math.min(totalDays, differenceInCalendarDays(today, start) + 1));
    const progress = (elapsed / totalDays) * 100;
    const status = bucketOf(trip);

    return (
        <Card className="bg-card/40 border-white/5 backdrop-blur-xl hover:bg-card/60 hover:border-white/10 transition-all">
            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                    <Link href={`/trips/${trip.id}`} className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold truncate">{trip.name}</h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-muted-foreground">
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
                        </div>
                    </Link>
                    <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(trip); }}
                        aria-label={`Edit ${trip.name}`}
                        className="shrink-0 w-8 h-8 rounded-full bg-secondary/30 hover:bg-secondary/50 flex items-center justify-center transition-colors"
                    >
                        <Edit2 className="w-3.5 h-3.5" />
                    </button>
                </div>

                {status !== 'upcoming' && (
                    <div className="mt-3 space-y-1.5">
                        <div className="flex justify-between text-[11px]">
                            <span className="text-muted-foreground">
                                {status === 'active' ? `Day ${elapsed} of ${totalDays}` : `${totalDays} days`}
                            </span>
                            <span className="font-bold text-sky-300 tabular-nums">{formatCurrency(total, trip.home_currency ?? undefined)}</span>
                        </div>
                        <Progress value={progress} className="h-1.5 bg-black/30" indicatorClassName={cn(status === 'active' ? 'bg-sky-400' : 'bg-white/20')} />
                    </div>
                )}
                {status === 'upcoming' && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                        Starts in {Math.max(0, differenceInCalendarDays(start, today))} days
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
    return (
        <Card className="bg-card/40 border-white/5 backdrop-blur-xl">
            <CardContent className="p-8 text-center space-y-3">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                    <Plane className="w-6 h-6 text-sky-300" aria-hidden="true" />
                </div>
                <h3 className="font-bold">No trips yet</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    Create a trip to auto-tag expenses while you&apos;re away, and get a summary of every dollar spent.
                </p>
                <Button onClick={onCreate} className="mt-2">
                    <Plus className="w-4 h-4 mr-1" /> New trip
                </Button>
            </CardContent>
        </Card>
    );
}
