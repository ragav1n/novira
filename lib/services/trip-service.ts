import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { toast } from '@/utils/haptics';
import { Trip, TripInput, tripSlug } from '@/types/trip';

const TRIP_SELECT = 'id, user_id, group_id, name, slug, start_date, end_date, home_currency, base_location, auto_tag_enabled, created_at';

// Returns the LOCAL date in YYYY-MM-DD form. Using toISOString() would convert
// to UTC and break trip lookups for users with negative offsets near midnight.
function isoDate(d: Date | string): string {
    if (typeof d === 'string') return d.slice(0, 10);
    return format(d, 'yyyy-MM-dd');
}

async function uniqueSlug(userId: string, baseSlug: string, excludeId?: string): Promise<string> {
    const base = baseSlug || 'trip';
    for (let attempt = 0; attempt < 50; attempt++) {
        const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`.slice(0, 32);
        let query = supabase
            .from('trips')
            .select('id')
            .eq('user_id', userId)
            .eq('slug', candidate)
            .limit(1);
        if (excludeId) query = query.neq('id', excludeId);
        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) return candidate;
    }
    return `${base}-${Date.now().toString(36)}`.slice(0, 32);
}

export const TripService = {
    async getTripsForUser(userId: string, workspaceId?: string | null): Promise<Trip[]> {
        let query = supabase
            .from('trips')
            .select(TRIP_SELECT)
            .order('start_date', { ascending: false });

        if (workspaceId) {
            query = query.eq('group_id', workspaceId);
        } else {
            query = query.eq('user_id', userId).is('group_id', null);
        }

        const { data, error } = await query;
        if (error) {
            console.error('Error fetching trips:', error);
            throw error;
        }
        return (data ?? []) as Trip[];
    },

    async getTripById(tripId: string): Promise<Trip | null> {
        const { data, error } = await supabase
            .from('trips')
            .select(TRIP_SELECT)
            .eq('id', tripId)
            .maybeSingle();
        if (error) {
            console.error('Error fetching trip:', error);
            return null;
        }
        return data as Trip | null;
    },

    async getActiveTripForDate(
        userId: string,
        date: Date | string,
        workspaceId?: string | null
    ): Promise<Trip | null> {
        const dateStr = isoDate(date);
        let query = supabase
            .from('trips')
            .select(TRIP_SELECT)
            .lte('start_date', dateStr)
            .gte('end_date', dateStr)
            .eq('auto_tag_enabled', true)
            .order('created_at', { ascending: false })
            .limit(1);

        if (workspaceId) {
            query = query.eq('group_id', workspaceId);
        } else {
            query = query.eq('user_id', userId).is('group_id', null);
        }

        const { data, error } = await query;
        if (error) {
            console.error('Error fetching active trip:', error);
            return null;
        }
        return (data && data[0]) ? (data[0] as Trip) : null;
    },

    async createTrip(userId: string, input: TripInput, workspaceId?: string | null): Promise<Trip> {
        const slug = await uniqueSlug(userId, tripSlug(input.name));
        const payload = {
            user_id: userId,
            group_id: workspaceId ?? null,
            name: input.name.trim(),
            slug,
            start_date: isoDate(input.start_date),
            end_date: isoDate(input.end_date),
            home_currency: input.home_currency ?? null,
            base_location: input.base_location?.trim() || null,
            auto_tag_enabled: input.auto_tag_enabled ?? true,
        };
        const { data, error } = await supabase
            .from('trips')
            .insert(payload)
            .select(TRIP_SELECT)
            .single();

        if (error) {
            toast.error('Failed to create trip');
            throw error;
        }
        toast.success('Trip created');
        return data as Trip;
    },

    async updateTrip(userId: string, tripId: string, patch: Partial<TripInput>): Promise<void> {
        const update: Record<string, unknown> = {};
        if (patch.name !== undefined) {
            update.name = patch.name.trim();
            update.slug = await uniqueSlug(userId, tripSlug(patch.name), tripId);
        }
        if (patch.start_date !== undefined) update.start_date = isoDate(patch.start_date);
        if (patch.end_date !== undefined) update.end_date = isoDate(patch.end_date);
        if (patch.home_currency !== undefined) update.home_currency = patch.home_currency;
        if (patch.base_location !== undefined) update.base_location = patch.base_location?.trim() || null;
        if (patch.auto_tag_enabled !== undefined) update.auto_tag_enabled = patch.auto_tag_enabled;

        const { error } = await supabase
            .from('trips')
            .update(update)
            .eq('id', tripId);

        if (error) {
            toast.error('Failed to update trip');
            throw error;
        }
        toast.success('Trip updated');
    },

    async deleteTrip(tripId: string): Promise<void> {
        const { error } = await supabase
            .from('trips')
            .delete()
            .eq('id', tripId);

        if (error) {
            toast.error('Failed to delete trip');
            throw error;
        }
        toast.success('Trip deleted');
    },
};
