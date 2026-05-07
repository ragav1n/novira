import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export type SlotName = 'morning' | 'midday' | 'evening';
export type SendKind = `slot:${SlotName}` | `event:${string}`;

/**
 * Resolve the user's local civil date as YYYY-MM-DD for the given timezone.
 * Used to dedupe slot notifications (one per slot per local day) regardless of
 * what UTC date the cron tick fires on.
 */
export function localDateInTimezone(timezone: string | null | undefined, now: Date = new Date()): string {
    const tz = timezone || 'UTC';
    try {
        const fmt = new Intl.DateTimeFormat('en-CA', {
            timeZone: tz,
            year: 'numeric', month: '2-digit', day: '2-digit',
        });
        return fmt.format(now);
    } catch {
        return now.toISOString().slice(0, 10);
    }
}

/**
 * Resolve the user's local hour 0-23 in the given timezone.
 */
export function localHourInTimezone(timezone: string | null | undefined, now: Date = new Date()): number | null {
    const tz = timezone || 'UTC';
    try {
        const fmt = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            hour: 'numeric',
            hour12: false,
        });
        const parts = fmt.formatToParts(now);
        const h = parts.find(p => p.type === 'hour')?.value;
        if (!h) return null;
        const n = parseInt(h, 10);
        if (isNaN(n)) return null;
        return n === 24 ? 0 : n;
    } catch {
        return null;
    }
}

export async function logSend(
    supabase: SupabaseClient,
    userId: string,
    kind: SendKind,
    localDate: string,
): Promise<void> {
    const { error } = await supabase.from('notification_send_log').insert({
        user_id: userId, kind, local_date: localDate,
    });
    if (error) {
        // Slot dedup unique constraint violation is benign — another tick fired
        // first. Log everything else; never throw, since failure here mustn't
        // block the cron job that already sent the notification.
        if (error.code !== '23505') {
            console.error('[send-log] insert failed', { kind, userId, error: error.message });
        }
    }
}

export async function sentInLastNHours(
    supabase: SupabaseClient,
    userId: string,
    hours: number,
): Promise<boolean> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const { count, error } = await supabase
        .from('notification_send_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('sent_at', since);
    if (error) {
        console.error('[send-log] sentInLastNHours failed', error.message);
        return false;
    }
    return (count ?? 0) > 0;
}

export async function alreadySentSlotToday(
    supabase: SupabaseClient,
    userId: string,
    slot: SlotName,
    localDate: string,
): Promise<boolean> {
    const { count, error } = await supabase
        .from('notification_send_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('local_date', localDate)
        .eq('kind', `slot:${slot}`);
    if (error) {
        console.error('[send-log] alreadySentSlotToday failed', error.message);
        return false;
    }
    return (count ?? 0) > 0;
}
