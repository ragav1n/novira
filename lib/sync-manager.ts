import { get, set, del } from 'idb-keyval';
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
    SyncPayload,
    addToQueue,
    startSyncing,
    markSynced,
    markFailed,
    incrementRetry,
    removeSynced,
    evictForCapacity,
    expireStaleItems,
    resetStaleSyncing,
    findPendingDuplicate,
    mergePendingUpdate,
    MAX_QUEUE_SIZE
} from './offline-sync-queue';
import { TransactionService } from './services/transaction-service';
import { invalidateTransactionCaches } from './sw-cache';

const LEGACY_QUEUE_KEY = 'novira-offline-queue';
const QUEUE_KEY_PREFIX = 'novira-offline-queue:';
const MUTATION_TIMEOUT_MS = 20_000;
const SYNC_LOCK_NAME = 'novira-sync-lock';
const SYNC_BROADCAST_CHANNEL = 'novira-sync';

let isSyncingLoopActive = false;
let currentUserId: string | null = null;
let legacyMigrationDone = false;
let broadcastChannel: BroadcastChannel | null = null;

function queueKey(): string | null {
    if (!currentUserId) return null;
    return QUEUE_KEY_PREFIX + currentUserId;
}

function getBroadcastChannel(): BroadcastChannel | null {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
    if (!broadcastChannel) broadcastChannel = new BroadcastChannel(SYNC_BROADCAST_CHANNEL);
    return broadcastChannel;
}

/**
 * Echo a queue-state event to other tabs so their UI reflects the change without
 * each tab needing to re-read IndexedDB. Only the originating tab persists.
 */
function broadcast(type: string, payload?: unknown) {
    const ch = getBroadcastChannel();
    if (!ch) return;
    try { ch.postMessage({ type, payload }); } catch { /* closed channel */ }
}

function dispatchQueueUpdated(queue: SyncPayload[]) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('novira-queue-updated', { detail: { queue } }));
    broadcast('novira-queue-updated', { queue });
}

/**
 * Bind the queue to the active user. Called by the auth provider on session
 * change. Migrates a legacy single-key queue to the user-scoped key on first
 * sign-in so existing pending items aren't stranded.
 */
export async function setQueueUser(userId: string | null): Promise<void> {
    const previous = currentUserId;
    currentUserId = userId;

    if (typeof window === 'undefined') return;

    if (userId && !legacyMigrationDone) {
        legacyMigrationDone = true;
        try {
            const legacy = await get<SyncPayload[]>(LEGACY_QUEUE_KEY);
            if (legacy && legacy.length > 0) {
                const target = QUEUE_KEY_PREFIX + userId;
                const existing = (await get<SyncPayload[]>(target)) || [];
                const merged = existing.length === 0 ? legacy : [...existing, ...legacy];
                await set(target, merged);
                await del(LEGACY_QUEUE_KEY);
            }
        } catch {
            // Migration is best-effort; failure leaves legacy items in place.
        }
    }

    // Refresh listeners in this tab. On sign-out (userId===null), surface an
    // empty queue so the indicator clears immediately. On user-switch, load the
    // new user's queue from IDB.
    if (userId !== previous) {
        let next: SyncPayload[] = [];
        if (userId) {
            try { next = (await get<SyncPayload[]>(QUEUE_KEY_PREFIX + userId)) || []; } catch { next = []; }
        }
        dispatchQueueUpdated(next);
    }
}

/** Read the active user's queue, or empty if no user is bound. */
async function readQueue(): Promise<SyncPayload[]> {
    const key = queueKey();
    if (!key) return [];
    return (await get<SyncPayload[]>(key)) || [];
}

/** Public read for UI hooks that want to hydrate on mount. */
export async function getCurrentQueue(): Promise<SyncPayload[]> {
    return readQueue();
}

async function writeQueue(queue: SyncPayload[]): Promise<void> {
    const key = queueKey();
    if (!key) return;
    await set(key, queue);
}

function uuidv4() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
        (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
    );
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
        promise.then(
            v => { clearTimeout(timer); resolve(v); },
            e => { clearTimeout(timer); reject(e); }
        );
    });
}

// Supabase Postgrest error codes that should be treated as permanent (no retry).
// 42501 = insufficient_privilege (RLS), PGRST116 = singular row not found.
const PERMANENT_PG_CODES = new Set(['42501', 'PGRST116']);

/**
 * Classify a Postgrest error into a stable retry vs. permanent decision.
 * Permanent errors are marked failed; transient errors throw to trigger backoff.
 */
function classifyPgError(error: PostgrestError): { permanent: boolean; reason: string } {
    const reason = error.code ? `${error.code}: ${error.message}` : error.message;
    // Postgrest doesn't expose `status` on the type but does set it at runtime.
    const status = (error as PostgrestError & { status?: number }).status;
    const is4xx = typeof status === 'number' && status >= 400 && status < 500;
    const permanent = is4xx || (typeof error.code === 'string' && PERMANENT_PG_CODES.has(error.code));
    return { permanent, reason };
}

/**
 * Generic error classifier for ADD path — the RPC throws either a Postgrest
 * error (with `.code`/`.status`) or a plain Error from `data.error`. We treat
 * known permanent codes / 4xx as permanent; everything else is transient.
 */
function classifyAddError(err: unknown): { permanent: boolean; reason: string } {
    if (err && typeof err === 'object') {
        const e = err as { code?: unknown; status?: unknown; message?: unknown };
        const code = typeof e.code === 'string' ? e.code : undefined;
        const status = typeof e.status === 'number' ? e.status : undefined;
        const message = typeof e.message === 'string' ? e.message : 'Unknown error';
        const is4xx = typeof status === 'number' && status >= 400 && status < 500;
        const permanent = is4xx || (code !== undefined && PERMANENT_PG_CODES.has(code));
        const reason = code ? `${code}: ${message}` : message;
        return { permanent, reason };
    }
    return { permanent: false, reason: String(err) };
}

export class QueueFullError extends Error {
    constructor() {
        super(`Offline queue is full (${MAX_QUEUE_SIZE} items). Please reconnect to sync pending items.`);
        this.name = 'QueueFullError';
    }
}

// 1. Enqueue Function
export async function enqueueMutation(type: string, data: any): Promise<string> {
    let currentQueue = await readQueue();

    // Dedup: a duplicate DELETE for the same tx id is pure waste — return the
    // existing pending item's id so callers see the same idempotent result.
    const dup = findPendingDuplicate(currentQueue, type, data);
    if (dup) return dup.id;

    // Merge: a newer UPDATE patch for the same tx folds into the pending one
    // so we don't waste a round-trip and so newer field values win cleanly.
    if (type === 'UPDATE_TRANSACTION' && data?.id) {
        const merged = mergePendingUpdate(currentQueue, data);
        if (merged) {
            await writeQueue(merged.queue);
            dispatchQueueUpdated(merged.queue);
            if (navigator.onLine) attemptSync();
            return merged.mergedId;
        }
    }

    // Evict oldest failed/pending items if at capacity. Currently-syncing items are preserved.
    if (currentQueue.length >= MAX_QUEUE_SIZE) {
        const beforeCount = currentQueue.length;
        currentQueue = evictForCapacity(currentQueue);
        const evictedCount = beforeCount - currentQueue.length;
        if (evictedCount > 0) {
            window.dispatchEvent(new CustomEvent('novira-queue-evicted', { detail: { count: evictedCount } }));
            broadcast('novira-queue-evicted', { count: evictedCount });
        }
        if (currentQueue.length >= MAX_QUEUE_SIZE) {
            throw new QueueFullError();
        }
    }

    const id = uuidv4();
    const newQueue = addToQueue(currentQueue, { id, type, data });
    await writeQueue(newQueue);

    dispatchQueueUpdated(newQueue);

    if (navigator.onLine) {
        attemptSync();
    } else if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready.then(reg => {
            (reg as any).sync.register('novira-sync-queue').catch(() => {});
        });
    }
    return id;
}

/**
 * Run `body` only if no other tab currently holds the sync lock. Falls back to
 * an unguarded run on browsers without Web Locks (in which case the in-tab
 * `isSyncingLoopActive` flag still prevents intra-tab overlap).
 */
async function withSyncLock(body: () => Promise<void>): Promise<void> {
    if (typeof navigator !== 'undefined' && (navigator as any).locks?.request) {
        await (navigator as any).locks.request(SYNC_LOCK_NAME, { ifAvailable: true }, async (lock: unknown) => {
            if (!lock) return; // another tab is syncing — yield
            await body();
        });
    } else {
        await body();
    }
}

// 3. Process the Queue
export async function attemptSync() {
    if (isSyncingLoopActive) return;
    if (!currentUserId) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    isSyncingLoopActive = true;
    try {
        await withSyncLock(runSyncLoop);
    } finally {
        isSyncingLoopActive = false;
    }
}

async function runSyncLoop(): Promise<void> {
    let queue = await readQueue();
    const now = Date.now();

    // Recover items stranded in 'syncing' by a previous session (tab killed
    // mid-flight). Without this they're invisible to the pending filter below
    // and never retry.
    const recovered = resetStaleSyncing(queue);
    if (recovered !== queue) {
        queue = recovered;
        await writeQueue(queue);
        dispatchQueueUpdated(queue);
    }

    // Expire pending items older than 7 days so they stop retrying forever and
    // surface to the user as "Expired" in the failed list.
    const expired = expireStaleItems(queue, now);
    if (expired !== queue) {
        const expiredCount = expired.filter((it, i) => queue[i]?.status === 'pending' && it.status === 'failed').length;
        queue = expired;
        await writeQueue(queue);
        dispatchQueueUpdated(queue);
        if (expiredCount > 0) {
            window.dispatchEvent(new CustomEvent('novira-queue-expired', { detail: { count: expiredCount } }));
            broadcast('novira-queue-expired', { count: expiredCount });
        }
    }

    const pendingItems = queue.filter(item =>
        item.status === 'pending' &&
        (!item.nextRetryAt || item.nextRetryAt <= now)
    );

    if (pendingItems.length === 0) return;
    if (!navigator.onLine) return;

    // Notify UI we are actively syncing
    window.dispatchEvent(new CustomEvent('novira-sync-started', { detail: { total: pendingItems.length } }));
    broadcast('novira-sync-started', { total: pendingItems.length });

    let done = 0;
    const total = pendingItems.length;

    try {
        for (const item of pendingItems) {
            // Transition to Syncing
            queue = startSyncing(queue, item.id);
            await writeQueue(queue);
            dispatchQueueUpdated(queue);

            try {
                if (item.type === 'ADD_FULL_TRANSACTION') {
                    const { transaction, splitRecords, recurringRecord } = item.data;
                    // Use the queue id as idempotency_key so retries dedupe at the RPC layer.
                    const result = await withTimeout(
                        TransactionService.createTransaction({
                            transaction: { ...transaction, idempotency_key: item.id },
                            splits: splitRecords,
                            recurring: recurringRecord
                        }),
                        MUTATION_TIMEOUT_MS,
                        'ADD_FULL_TRANSACTION'
                    );

                    if (result.success) {
                        queue = markSynced(queue, item.id);
                        window.dispatchEvent(new CustomEvent('novira-mutation-synced', {
                            detail: { id: item.id, type: item.type, data: item.data, result }
                        }));
                    } else {
                        throw new Error('Failed to create transaction via sync');
                    }
                } else if (item.type === 'DELETE_TRANSACTION') {
                    const { error } = await withTimeout(
                        Promise.resolve(
                            supabase
                                .from('transactions')
                                .delete()
                                .eq('id', item.data.id)
                        ),
                        MUTATION_TIMEOUT_MS,
                        'DELETE_TRANSACTION'
                    );

                    if (error) {
                        const { permanent, reason } = classifyPgError(error);
                        if (permanent) {
                            // Permanent failure: RLS violation, not found, or other 4xx.
                            // Note: RLS-filtered deletes succeed with 0 rows (no error), so this branch
                            // is only hit on actual rejection.
                            queue = markFailed(queue, item.id, reason, 'permanent');
                            window.dispatchEvent(new CustomEvent('novira-mutation-failed-permanent', {
                                detail: { id: item.id, type: item.type, data: item.data, reason }
                            }));
                        } else {
                            throw new Error(reason);
                        }
                    } else {
                        // Postgres treats delete-with-no-match as success (0 rows). That's the
                        // idempotent behavior we want — already-deleted is the same as deleted now.
                        queue = markSynced(queue, item.id);
                        window.dispatchEvent(new CustomEvent('novira-mutation-synced', {
                            detail: { id: item.id, type: item.type, data: item.data }
                        }));
                    }
                } else if (item.type === 'UPDATE_TRANSACTION') {
                    const { id, patch } = item.data;
                    const { error } = await withTimeout(
                        Promise.resolve(
                            supabase
                                .from('transactions')
                                .update(patch)
                                .eq('id', id)
                        ),
                        MUTATION_TIMEOUT_MS,
                        'UPDATE_TRANSACTION'
                    );

                    if (error) {
                        const { permanent, reason } = classifyPgError(error);
                        if (permanent) {
                            queue = markFailed(queue, item.id, reason, 'permanent');
                            window.dispatchEvent(new CustomEvent('novira-mutation-failed-permanent', {
                                detail: { id: item.id, type: item.type, data: item.data, reason }
                            }));
                        } else {
                            throw new Error(reason);
                        }
                    } else {
                        queue = markSynced(queue, item.id);
                        window.dispatchEvent(new CustomEvent('novira-mutation-synced', {
                            detail: { id: item.id, type: item.type, data: item.data }
                        }));
                    }
                }
            } catch (e) {
                // ADD path: some errors (RLS, validation) are permanent and won't pass on retry.
                // Classify before backing off so the user isn't waiting on hopeless retries.
                if (item.type === 'ADD_FULL_TRANSACTION') {
                    const { permanent, reason } = classifyAddError(e);
                    if (permanent) {
                        queue = markFailed(queue, item.id, reason, 'permanent');
                        window.dispatchEvent(new CustomEvent('novira-mutation-failed-permanent', {
                            detail: { id: item.id, type: item.type, data: item.data, reason }
                        }));
                        await writeQueue(queue);
                        done++;
                        window.dispatchEvent(new CustomEvent('novira-sync-progress', { detail: { done, total } }));
                        broadcast('novira-sync-progress', { done, total });
                        continue;
                    }
                }
                // Temporary network/server failure — apply exponential backoff with jitter.
                if (process.env.NODE_ENV === 'development') {
                    console.error(`[sync-manager] ${item.type} failed, will retry:`, e);
                }
                queue = incrementRetry(queue, item.id);
            }

            await writeQueue(queue);
            done++;
            window.dispatchEvent(new CustomEvent('novira-sync-progress', { detail: { done, total } }));
            broadcast('novira-sync-progress', { done, total });
        }

        // Clean up
        queue = removeSynced(queue);
        await writeQueue(queue);
        dispatchQueueUpdated(queue);

        // After offline-queued mutations land on the server, the SW's SWR cache for
        // transaction reads is stale until next refresh. Invalidate so the next read
        // (here or in any other tab — caches are origin-shared) hits the network.
        invalidateTransactionCaches();
    } finally {
        window.dispatchEvent(new Event('novira-sync-finished'));
        broadcast('novira-sync-finished');
    }
}

// 4. Manual Retry for Failed Items
export async function retryFailedItem(id: string) {
    let queue = await readQueue();
    queue = queue.map(item => item.id === id
        ? { ...item, status: 'pending', retryCount: 0, nextRetryAt: undefined, errorReason: undefined, failedAt: undefined, errorKind: undefined }
        : item
    );
    await writeQueue(queue);
    dispatchQueueUpdated(queue);
    attemptSync();
}

export async function discardFailedItem(id: string) {
    let queue = await readQueue();
    queue = queue.filter(item => item.id !== id);
    await writeQueue(queue);
    dispatchQueueUpdated(queue);
}

// 5. Initialize Online Listeners + Background Sync + Cross-Tab Echo
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        attemptSync();
        // Re-register background sync tag whenever we come back online
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            navigator.serviceWorker.ready.then(reg => {
                (reg as any).sync.register('novira-sync-queue').catch(() => {});
            });
        }
    });

    // Handle BG_SYNC_TRIGGERED message from service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data?.type === 'BG_SYNC_TRIGGERED') {
                attemptSync();
            }
        });
    }

    // Mirror sync events from sibling tabs into local DOM events so any
    // listener that uses window.addEventListener picks them up uniformly.
    const ch = getBroadcastChannel();
    if (ch) {
        ch.onmessage = (ev) => {
            const msg = ev.data as { type?: string; payload?: any } | null;
            if (!msg?.type) return;
            switch (msg.type) {
                case 'novira-queue-updated':
                    window.dispatchEvent(new CustomEvent('novira-queue-updated', { detail: msg.payload }));
                    break;
                case 'novira-sync-started':
                    window.dispatchEvent(new CustomEvent('novira-sync-started', { detail: msg.payload }));
                    break;
                case 'novira-sync-finished':
                    window.dispatchEvent(new Event('novira-sync-finished'));
                    break;
                case 'novira-sync-progress':
                    window.dispatchEvent(new CustomEvent('novira-sync-progress', { detail: msg.payload }));
                    break;
                case 'novira-queue-expired':
                    window.dispatchEvent(new CustomEvent('novira-queue-expired', { detail: msg.payload }));
                    break;
                case 'novira-queue-evicted':
                    window.dispatchEvent(new CustomEvent('novira-queue-evicted', { detail: msg.payload }));
                    break;
            }
        };
    }
}

/** Register a background sync tag (call after queuing an item) */
export async function registerBackgroundSync(): Promise<void> {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        try {
            const reg = await navigator.serviceWorker.ready;
            await (reg as any).sync.register('novira-sync-queue');
        } catch {
            // SyncManager not available — graceful fallback
        }
    }
}
