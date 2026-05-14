'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { TripService } from '@/lib/services/trip-service';
import type { Trip } from '@/types/trip';

interface ActiveTripContextValue {
    activeTrip: Trip | null;
    loading: boolean;
    refresh: () => Promise<void>;
}

const ActiveTripContext = createContext<ActiveTripContextValue | undefined>(undefined);

export function useActiveTrip(): ActiveTripContextValue {
    const ctx = useContext(ActiveTripContext);
    if (!ctx) return { activeTrip: null, loading: false, refresh: async () => {} };
    return ctx;
}

function midnightMsFromNow(): number {
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    return Math.max(1000, next.getTime() - now.getTime());
}

export function ActiveTripProvider({ children }: { children: React.ReactNode }) {
    const { userId, activeWorkspaceId } = useUserPreferences();
    const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
    const [loading, setLoading] = useState<boolean>(!!userId);

    const refresh = useCallback(async () => {
        if (!userId) {
            setActiveTrip(null);
            setLoading(false);
            return;
        }
        try {
            const trip = await TripService.getActiveTripForDate(userId, new Date(), activeWorkspaceId);
            setActiveTrip(trip);
        } catch (e) {
            console.error('[ActiveTripProvider] refresh failed', e);
            setActiveTrip(null);
        } finally {
            setLoading(false);
        }
    }, [userId, activeWorkspaceId]);

    useEffect(() => {
        setLoading(true);
        refresh();
    }, [refresh]);

    // Re-check at midnight in case the active trip rolls over.
    useEffect(() => {
        const timeout = setTimeout(() => { refresh(); }, midnightMsFromNow());
        return () => clearTimeout(timeout);
    }, [refresh, activeTrip?.id]);

    // Realtime: re-fetch when trips change for this user/workspace.
    useEffect(() => {
        if (!userId) return;
        const filter = activeWorkspaceId
            ? `group_id=eq.${activeWorkspaceId}`
            : `user_id=eq.${userId}`;
        const channel = supabase
            .channel(`active-trip-${userId}-${activeWorkspaceId || 'personal'}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'trips', filter },
                () => { refresh(); },
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [userId, activeWorkspaceId, refresh]);

    return (
        <ActiveTripContext.Provider value={{ activeTrip, loading, refresh }}>
            {children}
        </ActiveTripContext.Provider>
    );
}
