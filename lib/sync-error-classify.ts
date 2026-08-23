import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Retry-vs-abandon decisions for the offline queue. Pure, and deliberately kept
 * out of sync-manager.ts so it can be tested without the Supabase client: this is
 * the code that decides whether a change the user made is retried or written off,
 * so it is worth pinning down.
 */

/**
 * Stand-in code for a rejection the RPC returned as HTTP 200. `create_transaction_atomic`
 * swallows its own exceptions, so this is the only marker that separates "the server
 * refused this row" from "the request never arrived".
 */
export const RPC_REJECTED = 'RPC_REJECTED';

const PERMANENT_PG_CODES = new Set(['42501', 'PGRST116', RPC_REJECTED]);

/**
 * SQLSTATEs worth another attempt, by class. Everything else that reaches
 * `create_transaction_atomic`'s exception handler is deterministic — a constraint
 * violation, a bad cast, a missing column — and will fail identically five times
 * while the retry loop overwrites the one string that explained it.
 *
 * Whole classes rather than an enumerated list: the individual codes matter less than
 * the category, and an enumeration silently marks its own gaps permanent. `57P01`
 * (admin_shutdown, i.e. Supabase restarting the database) is the one that makes this
 * worth getting right — retiring a queued expense over a maintenance window would be
 * a far worse bug than the one this classification is here to fix.
 */
const TRANSIENT_SQLSTATE_CLASSES = new Set([
    '08', // connection_exception
    '40', // transaction_rollback — serialization_failure, deadlock_detected
    '53', // insufficient_resources — too_many_connections, disk full
    '57', // operator_intervention — query_canceled, admin_shutdown, cannot_connect_now
]);

/** Retryable codes whose class as a whole is not. */
const TRANSIENT_SQLSTATES = new Set(['55P03']); // lock_not_available

/** A five-character SQLSTATE, as opposed to a PostgREST code like PGRST116. */
const SQLSTATE = /^[0-9A-Z]{5}$/;

function isTransientSqlState(code: string): boolean {
    return TRANSIENT_SQLSTATES.has(code) || TRANSIENT_SQLSTATE_CLASSES.has(code.slice(0, 2));
}

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
 * The ADD and receipt-upload paths throw one of three shapes: a Postgrest error
 * (`.code`/`.status`), a Storage `StorageApiError` (`.statusCode`, a string), or a
 * plain Error the service tagged with `code: RPC_REJECTED` because
 * create_transaction_atomic answered HTTP 200 with `{ success: false, error }`.
 * All three now classify; only genuine transport failures stay transient.
 */
export function classifyAddError(err: unknown): { permanent: boolean; reason: string } {
    if (err && typeof err === 'object') {
        const e = err as { code?: unknown; status?: unknown; statusCode?: unknown; message?: unknown };
        const code = typeof e.code === 'string' ? e.code : undefined;
        // Storage rejections are `StorageApiError`, which carries the HTTP status as a
        // *string* `statusCode`. Reading only the numeric `status` meant a 403 on the
        // receipts bucket looked like a network error and burned all five retries.
        const status = typeof e.status === 'number'
            ? e.status
            : typeof e.statusCode === 'string' && /^\d+$/.test(e.statusCode)
                ? Number(e.statusCode)
                : typeof e.statusCode === 'number' ? e.statusCode : undefined;
        const message = typeof e.message === 'string' ? e.message : 'Unknown error';
        const permanent = isPermanentStatus(status)
            || (code !== undefined && PERMANENT_PG_CODES.has(code))
            // A real SQLSTATE means Postgres itself rejected the statement, which is
            // deterministic unless it came from contention or an unavailable server.
            || (code !== undefined && SQLSTATE.test(code) && !isTransientSqlState(code));
        const reason = code && code !== RPC_REJECTED ? `${code}: ${message}` : message;
        return { permanent, reason };
    }
    return { permanent: false, reason: String(err) };
}
