import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Retry-vs-abandon decisions for the offline queue. Pure, and deliberately kept
 * out of sync-manager.ts so it can be tested without the Supabase client: this is
 * the code that decides whether a change the user made is retried or written off,
 * so it is worth pinning down.
 */

const PERMANENT_PG_CODES = new Set(['42501', 'PGRST116']);

/**
 * 4xx statuses that are NOT the caller's fault and must keep retrying.
 *
 * 401 is the important one: it means the access token had expired at the moment of
 * the call, which is the single most retryable thing that can happen — the client
 * refreshes and the next attempt works. Treating it as permanent meant one token
 * blip retired a change for good. A genuine authorisation failure surfaces as 403
 * or Postgres 42501, both of which stay permanent.
 *
 * 408 and 429 are transient by definition.
 */
const RETRYABLE_HTTP_STATUSES = new Set([401, 408, 429]);

export function isPermanentStatus(status: number | undefined): boolean {
    if (typeof status !== 'number') return false;
    if (RETRYABLE_HTTP_STATUSES.has(status)) return false;
    return status >= 400 && status < 500;
}

/** Permanent errors get marked failed; transient ones throw to trigger backoff. */
export function classifyPgError(error: PostgrestError): { permanent: boolean; reason: string } {
    const reason = error.code ? `${error.code}: ${error.message}` : error.message;
    // Postgrest doesn't expose `status` on the type but does set it at runtime.
    const status = (error as PostgrestError & { status?: number }).status;
    const permanent = isPermanentStatus(status)
        || (typeof error.code === 'string' && PERMANENT_PG_CODES.has(error.code));
    return { permanent, reason };
}

/**
 * The ADD path throws either a Postgrest error (with `.code`/`.status`) or a plain
 * Error carrying `data.error` — create_transaction_atomic catches internally and
 * returns `{ success: false, error }` with HTTP 200, so a constraint violation
 * arrives with no code at all and is treated as transient.
 */
export function classifyAddError(err: unknown): { permanent: boolean; reason: string } {
    if (err && typeof err === 'object') {
        const e = err as { code?: unknown; status?: unknown; message?: unknown };
        const code = typeof e.code === 'string' ? e.code : undefined;
        const status = typeof e.status === 'number' ? e.status : undefined;
        const message = typeof e.message === 'string' ? e.message : 'Unknown error';
        const permanent = isPermanentStatus(status)
            || (code !== undefined && PERMANENT_PG_CODES.has(code));
        const reason = code ? `${code}: ${message}` : message;
        return { permanent, reason };
    }
    return { permanent: false, reason: String(err) };
}
