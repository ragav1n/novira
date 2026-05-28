'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { Plane, Plus, Calendar as CalendarIcon, MapPin, Edit2 } from 'lucide-react';
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
            // Render the trip cards as soon as the list resolves; totals fill in
            // a beat later. Waiting for both queries to finish before hiding the
            // skeleton makes the tab feel slow on a clean cache.
            setLoading(false);

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
        <div className="space-y-5">
            <div className="flex justify-end -mt-1">
                <button
                    type="button"
                    onClick={openCreate}
                    disabled={loading}
                    aria-label="New trip"
                    className="inline-flex items-center gap-1 h-7 px-3 rounded-full text-[11px] font-semibold text-sky-300 hover:text-sky-200 hover:bg-sky-400/10 disabled:opacity-50 transition-colors"
                >
                    <Plus className="w-3.5 h-3.5" />
                    New trip
                </button>
            </div>

            {loading ? (
                <div className="space-y-2">
                    <div className="h-[88px] rounded-2xl bg-secondary/10 animate-pulse" />
                    <div className="h-[88px] rounded-2xl bg-secondary/10 animate-pulse" />
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
            <h2 className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60 px-1">
                {title} · {trips.length}
            </h2>
            <div className="space-y-2">
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
        <article className="relative overflow-hidden rounded-2xl border border-white/10 ring-1 ring-inset ring-sky-400/15 bg-white/[0.035] hover:bg-white/[0.055] transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.06),_0_6px_16px_-8px_rgba(0,0,0,0.55)]">
            <span className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r bg-sky-400" aria-hidden="true" />
            <div className="p-4 pl-[18px]">
                <div className="flex items-start justify-between gap-3">
                    <Link href={`/trips/${trip.id}`} className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-sky-400/[0.08] text-sky-400 flex items-center justify-center shrink-0">
                                <Plane className="w-[18px] h-[18px]" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-[15px] font-semibold tracking-tight truncate">{trip.name}</h3>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground">
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
                            </div>
                        </div>
                    </Link>
                    <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(trip); }}
                        aria-label={`Edit ${trip.name}`}
                        className="shrink-0 h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-secondary/30 transition-colors"
                    >
                        <Edit2 className="w-3.5 h-3.5" />
                    </button>
                </div>

                {status !== 'upcoming' && (
                    <div className="mt-3 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground">
                                {status === 'active' ? `Day ${elapsed} of ${totalDays}` : `${totalDays} days`}
                            </span>
                            <span className="font-bold text-sky-300 tabular-nums">
                                {formatCurrency(total, trip.home_currency ?? undefined)}
                            </span>
                        </div>
                        <div className="h-[3px] w-full bg-white/[0.04] rounded-full overflow-hidden">
                            <div
                                className={cn('h-full rounded-full', status === 'active' ? 'bg-sky-400' : 'bg-white/20')}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}
                {status === 'upcoming' && (
                    <p className="mt-3 text-[11px] text-muted-foreground">
                        Starts in {Math.max(0, differenceInCalendarDays(start, today))} days
                    </p>
                )}
            </div>
        </article>
    );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
    return (
        <div className="rounded-2xl border border-dashed border-white/[0.14] bg-white/[0.02] p-6 space-y-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="space-y-1.5">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                    No trips yet
                </p>
                <h3 className="text-base font-semibold tracking-tight">
                    Plan one and Novira will auto-tag.
                </h3>
                <p className="text-[12px] text-muted-foreground leading-relaxed max-w-xs">
                    Create a trip and any expense while you&apos;re away gets tagged automatically,
                    with a clean summary at the end.
                </p>
            </div>
            <button
                onClick={onCreate}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-sky-400 text-sky-950 text-[12px] font-semibold hover:bg-sky-300 transition-colors"
            >
                <Plus className="w-3.5 h-3.5" />
                New trip
            </button>
        </div>
    );
}
