import { get, set } from 'idb-keyval';
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
    findPendingDuplicate,
    mergePendingUpdate,
    MAX_QUEUE_SIZE
} from './offline-sync-queue';
import { TransactionService } from './services/transaction-service';
import { invalidateTransactionCaches } from './sw-cache';

const QUEUE_KEY = 'novira-offline-queue';
const MUTATION_TIMEOUT_MS = 20_000;
let isSyncingLoopActive = false;

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

export class QueueFullError extends Error {
    constructor() {
        super(`Offline queue is full (${MAX_QUEUE_SIZE} items). Please reconnect to sync pending items.`);
        this.name = 'QueueFullError';
    }
}

// 1. Enqueue Function
export async function enqueueMutation(type: string, data: any): Promise<string> {
    let currentQueue = (await get<SyncPayload[]>(QUEUE_KEY)) || [];

    // Dedup: a duplicate DELETE for the same tx id is pure waste — return the
    // existing pending item's id so callers see the same idempotent result.
    const dup = findPendingDuplicate(currentQueue, type, data);
    if (dup) return dup.id;

    // Merge: a newer UPDATE patch for the same tx folds into the pending one
    // so we don't waste a round-trip and so newer field values win cleanly.
    if (type === 'UPDATE_TRANSACTION' && data?.id) {
        const merged = mergePendingUpdate(currentQueue, data);
        if (merged) {
            await set(QUEUE_KEY, merged.queue);
            window.dispatchEvent(new CustomEvent('novira-queue-updated', { detail: { queue: merged.queue } }));
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
        }
        if (currentQueue.length >= MAX_QUEUE_SIZE) {
            throw new QueueFullError();
        }
    }

    const id = uuidv4();
    const newQueue = addToQueue(currentQueue, { id, type, data });
    await set(QUEUE_KEY, newQueue);

    window.dispatchEvent(new CustomEvent('novira-queue-updated', { detail: { queue: newQueue } }));

    if (navigator.onLine) {
        attemptSync();
    } else if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready.then(reg => {
            (reg as any).sync.register('novira-sync-queue').catch(() => {});
        });
    }
    return id;
}

// 3. Process the Queue
export async function attemptSync() {
    if (isSyncingLoopActive) return;

    let queue = (await get<SyncPayload[]>(QUEUE_KEY)) || [];
    const now = Date.now();

    // Expire pending items older than 7 days so they stop retrying forever and
    // surface to the user as "Expired" in the failed list.
    const expired = expireStaleItems(queue, now);
    if (expired !== queue) {
        queue = expired;
        await set(QUEUE_KEY, queue);
        window.dispatchEvent(new CustomEvent('novira-queue-updated', { detail: { queue } }));
    }

    const pendingItems = queue.filter(item =>
        item.status === 'pending' &&
        (!item.nextRetryAt || item.nextRetryAt <= now)
    );

    if (pendingItems.length === 0) return;
    if (!navigator.onLine) return;

    isSyncingLoopActive = true;

    // Notify UI we are actively syncing
    window.dispatchEvent(new Event('novira-sync-started'));

    try {
        for (const item of pendingItems) {
            // Transition to Syncing
            queue = startSyncing(queue, item.id);
            await set(QUEUE_KEY, queue);
            window.dispatchEvent(new CustomEvent('novira-queue-updated', { detail: { queue } }));

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
                            queue = markFailed(queue, item.id, reason);
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
                            queue = markFailed(queue, item.id, reason);
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
                // Temporary network/server failure — apply exponential backoff with jitter.
                if (process.env.NODE_ENV === 'development') {
                    console.error(`[sync-manager] ${item.type} failed, will retry:`, e);
                }
                queue = incrementRetry(queue, item.id);
            }

            await set(QUEUE_KEY, queue);
        }

        // Clean up
        queue = removeSynced(queue);
        await set(QUEUE_KEY, queue);
        window.dispatchEvent(new CustomEvent('novira-queue-updated', { detail: { queue } }));

        // After offline-queued mutations land on the server, the SW's SWR cache for
        // transaction reads is stale until next refresh. Invalidate so the next read
        // (here or in any other tab — caches are origin-shared) hits the network.
        invalidateTransactionCaches();
    } finally {
        window.dispatchEvent(new Event('novira-sync-finished'));
        isSyncingLoopActive = false;
    }
}

// 4. Manual Retry for Failed Items
export async function retryFailedItem(id: string) {
    let queue = (await get<SyncPayload[]>(QUEUE_KEY)) || [];
    queue = queue.map(item => item.id === id
        ? { ...item, status: 'pending', retryCount: 0, nextRetryAt: undefined, errorReason: undefined, failedAt: undefined }
        : item
    );
    await set(QUEUE_KEY, queue);
    window.dispatchEvent(new CustomEvent('novira-queue-updated', { detail: { queue } }));
    attemptSync();
}

export async function discardFailedItem(id: string) {
    let queue = (await get<SyncPayload[]>(QUEUE_KEY)) || [];
    queue = queue.filter(item => item.id !== id);
    await set(QUEUE_KEY, queue);
    window.dispatchEvent(new CustomEvent('novira-queue-updated', { detail: { queue } }));
}

// 5. Initialize Online Listeners + Background Sync
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
