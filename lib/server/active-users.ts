import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

// Distinct users with at least one transaction dated in [start, end]. Paged:
// PostgREST caps a response at 1,000 rows, so a single select of user_id saw
// only the first thousand transactions and silently skipped everyone after.
export async function activeUserIdsInRange(supabase: SupabaseClient, start: string, end: string): Promise<string[]> {
    const PAGE = 1000;
    const ids = new Set<string>();
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
            .from('transactions')
            .select('id, user_id')
            .gte('date', start)
            .lte('date', end)
            .order('id')
            .range(from, from + PAGE - 1);
        if (error) throw error;
        for (const row of data || []) ids.add(row.user_id as string);
        if (!data || data.length < PAGE) return [...ids];
    }
}
