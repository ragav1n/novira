import { get, set, del } from 'idb-keyval';
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
    createSerializedMutator,
    MAX_QUEUE_SIZE
} from './offline-sync-queue';
import { TransactionService } from './services/transaction-service';
import { invalidateTransactionCaches } from './sw-cache';
import { getOfflineReceipt, saveOfflineReceipt, deleteOfflineReceipt } from './offline-receipt-store';
import { uploadReceipt, deleteReceipt } from './receipt-storage';
import { classifyAddError, classifyPgError } from './sync-error-classify';
import { getErrorMessage } from './error-utils';

const LEGACY_QUEUE_KEY = 'novira-offline-queue';
const QUEUE_KEY_PREFIX = 'novira-offline-queue:';
const MUTATION_TIMEOUT_MS = 20_000;
// How long to wait before re-checking the queue when a sibling tab holds the sync lock.
const LOCK_CONTENTION_RETRY_MS = 2_000;
// Uploads get their own, larger budget. A receipt is orders of magnitude bigger
// than an RPC payload, and sharing the 20s mutation timeout meant a normal phone
// photo on a mobile uplink timed out before it finished.
const RECEIPT_UPLOAD_TIMEOUT_MS = 60_000;
const SYNC_LOCK_NAME = 'novira-sync-lock';
const SYNC_BROADCAST_CHANNEL = 'novira-sync';

let isSyncingLoopActive = false;
let currentUserId: string | null = null;
let legacyMigrationDone = false;
let broadcastChannel: BroadcastChannel | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

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
        // Drop any backoff timer armed for the previous user's queue.
        clearRetryTimer();
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
    try {
        return (await get<SyncPayload[]>(key)) || [];
    } catch (error) {
        // IDB can throw on quota, corruption, or in private browsing modes. Treat
        // as empty so the rest of the sync layer keeps functioning instead of
        // crashing every read path.
        console.error('[sync-manager] readQueue failed:', error);
        return [];
    }
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

// Every queue write goes through here. See createSerializedMutator for why a
// plain read-then-write loses mutations enqueued mid-sync.
const mutateQueue = createSerializedMutator(readQueue, writeQueue);

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

export class QueueFullError extends Error {
    constructor() {
        super(`Offline queue is full (${MAX_QUEUE_SIZE} items). Please reconnect to sync pending items.`);
        this.name = 'QueueFullError';
    }
}

// 1. Enqueue Function
export async function enqueueMutation(type: string, data: any, opts?: { id?: string }): Promise<string> {
    // Pre-generated so the id has a non-nullable type; the dedupe/merge branches
    // below overwrite it with the id of the item they folded into.
    let resultId = opts?.id ?? uuidv4();
    let evictedIds: string[] = [];
    let queueFull = false;
    let wrote = true;

    // Inspect + write in one serialized step. Splitting them would let the sync
    // loop's own write land in between and clobber this enqueue.
    const finalQueue = await mutateQueue(current => {
        // Dedup: a duplicate DELETE for the same tx id is pure waste — return the
        // existing pending item's id so callers see the same idempotent result.
        const dup = findPendingDuplicate(current, type, data);
        if (dup) {
            resultId = dup.id;
            wrote = false;
            return current;
        }

        // Merge: a newer UPDATE patch for the same tx folds into the pending one
        // so we don't waste a round-trip and so newer field values win cleanly.
        if (type === 'UPDATE_TRANSACTION' && data?.id) {
            const merged = mergePendingUpdate(current, data);
            if (merged) {
                resultId = merged.mergedId;
                return merged.queue;
            }
        }

        // Evict oldest failed/pending items if at capacity. Currently-syncing items are preserved.
        let next = current;
        if (next.length >= MAX_QUEUE_SIZE) {
            const beforeIds = new Set(next.map(i => i.id));
            next = evictForCapacity(next);
            if (next.length >= MAX_QUEUE_SIZE) {
                // Nothing evictable (everything is mid-flight) — reject the enqueue
                // and leave the queue untouched.
                queueFull = true;
                wrote = false;
                return current;
            }
            const keptIds = new Set(next.map(i => i.id));
            evictedIds = [...beforeIds].filter(id => !keptIds.has(id));
        }

        return addToQueue(next, { id: resultId, type, data });
    });

    if (queueFull) throw new QueueFullError();

    if (evictedIds.length > 0) {
        // Best-effort cleanup of orphaned offline-receipt Blobs for evicted items.
        for (const id of evictedIds) deleteOfflineReceipt(id);
        window.dispatchEvent(new CustomEvent('novira-queue-evicted', { detail: { count: evictedIds.length } }));
        broadcast('novira-queue-evicted', { count: evictedIds.length });
    }

    if (wrote) {
        dispatchQueueUpdated(finalQueue);
    }

    if (navigator.onLine) {
        attemptSync();
    } else if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready.then(reg => {
            (reg as any).sync.register('novira-sync-queue').catch(() => {});
        });
    }
    return resultId;
}

/**
 * Run `body` only if no other tab currently holds the sync lock. Falls back to
 * an unguarded run on browsers without Web Locks (in which case the in-tab
 * `isSyncingLoopActive` flag still prevents intra-tab overlap).
 */
interface WebLock {
    name: string;
    mode: 'shared' | 'exclusive';
}
interface WebLockManager {
    request: (
        name: string,
        options: { ifAvailable?: boolean; mode?: 'shared' | 'exclusive' },
        callback: (lock: WebLock | null) => Promise<void>,
    ) => Promise<void>;
}

function getLockManager(): WebLockManager | null {
    if (typeof navigator === 'undefined') return null;
    const candidate = (navigator as Navigator & { locks?: unknown }).locks;
    if (
        candidate &&
        typeof candidate === 'object' &&
        'request' in candidate &&
        typeof (candidate as { request?: unknown }).request === 'function'
    ) {
        return candidate as WebLockManager;
    }
    return null;
}

async function withSyncLock(body: () => Promise<void>): Promise<void> {
    const locks = getLockManager();
    if (locks) {
        await locks.request(SYNC_LOCK_NAME, { ifAvailable: true }, async (lock) => {
            if (!lock) {
                // Another tab holds the lock. `scheduleRetry` only runs inside
                // runSyncLoop, so yielding here used to leave the queue pending with
                // no timer armed — if the other tab then closed mid-pass, nothing
                // re-fired until the next enqueue or reload.
                scheduleRetry(await readQueue(), LOCK_CONTENTION_RETRY_MS);
                return;
            }
            await body();
        });
    } else {
        await body();
    }
}

function clearRetryTimer() {
    if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
    }
}

/**
 * Self-drive the exponential backoff: after a sync pass leaves items pending
 * with a future `nextRetryAt`, schedule a single timer for the soonest one so
 * the loop re-fires on its own. Without this the backoff schedule only advances
 * incidentally (next enqueue / online event / app reload), stranding items that
 * hit a transient failure while the user stays online and idle.
 */
function scheduleRetry(queue: SyncPayload[], minDelayMs = 0) {
    if (typeof window === 'undefined') return;
    const now = Date.now();
    let soonest = Infinity;
    for (const item of queue) {
        if (item.status !== 'pending') continue;
        // A pending item with no backoff (or an elapsed one) is runnable right now.
        // That happens when it was enqueued while a sync pass was already in flight,
        // so the pass's `pendingItems` snapshot never saw it — schedule immediately
        // rather than leaving it until the next enqueue or online event.
        const dueAt = item.nextRetryAt && item.nextRetryAt > now ? item.nextRetryAt : now;
        if (dueAt < soonest) soonest = dueAt;
    }
    clearRetryTimer();
    if (soonest === Infinity) return;
    // `minDelayMs` is the floor for the lock-contention path: a runnable item resolves
    // to a 0ms delay, which against a tab that holds the lock for a while would spin
    // attemptSync in a tight loop.
    const delay = Math.max(minDelayMs, soonest - now);
    retryTimer = setTimeout(() => {
        retryTimer = null;
        attemptSync();
    }, delay);
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

/**
 * The row is already on the server, so a failed receipt upload must not fail the
 * transaction — but the photo is the only part with no server copy, so it must
 * not be thrown away either. Re-key the Blob under a fresh queue id and enqueue a
 * receipt-only item, which then rides the queue's normal backoff and retry.
 *
 * Re-keying (rather than reusing the original id) keeps the capacity-eviction and
 * expiry sweeps correct: both delete Blobs by queue-item id.
 */
async function handOffReceiptForRetry(queueId: string, txId: string, ownerId: string) {
    try {
        const blob = await getOfflineReceipt(queueId);
        if (!blob) return;
        const retryId = uuidv4();
        await saveOfflineReceipt(retryId, blob);
        await deleteOfflineReceipt(queueId);
        await enqueueMutation('UPLOAD_RECEIPT', { txId, ownerId }, { id: retryId });
    } catch (e) {
        // Couldn't even park it (storage full, IDB unavailable) — now the photo
        // really is unrecoverable, so say so.
        console.error('[sync-manager] could not queue receipt for retry:', e);
        await deleteOfflineReceipt(queueId);
        window.dispatchEvent(new CustomEvent('novira-receipt-upload-failed', {
            detail: { txId, queueId }
        }));
        broadcast('novira-receipt-upload-failed', { txId, queueId });
    }
}

async function runSyncLoop(): Promise<void> {
    let queue = await readQueue();
    const now = Date.now();

    // Recover items stranded in 'syncing' by a previous session (tab killed
    // mid-flight). Without this they're invisible to the pending filter below
    // and never retry. The pre-check keeps the common no-op pass write-free;
    // the transform re-runs inside mutateQueue against fresh state.
    if (resetStaleSyncing(queue) !== queue) {
        queue = await mutateQueue(resetStaleSyncing);
        dispatchQueueUpdated(queue);
    }

    // Expire pending items older than 7 days so they stop retrying forever and
    // surface to the user as "Expired" in the failed list.
    if (expireStaleItems(queue, now) !== queue) {
        let expiredIds: string[] = [];
        queue = await mutateQueue(q => {
            const next = expireStaleItems(q, now);
            const wasPending = new Set(q.filter(i => i.status === 'pending').map(i => i.id));
            expiredIds = next.filter(i => i.status === 'failed' && wasPending.has(i.id)).map(i => i.id);
            return next;
        });
        dispatchQueueUpdated(queue);
        if (expiredIds.length > 0) {
            // Drop offline receipts for newly-expired items — the row will never
            // post, so the Blob is dead weight in IDB.
            for (const id of expiredIds) deleteOfflineReceipt(id);
            window.dispatchEvent(new CustomEvent('novira-queue-expired', { detail: { count: expiredIds.length } }));
            broadcast('novira-queue-expired', { count: expiredIds.length });
        }
    }

    const pendingItems = queue.filter(item =>
        item.status === 'pending' &&
        (!item.nextRetryAt || item.nextRetryAt <= now)
    );

    if (pendingItems.length === 0) {
        // Nothing runnable right now, but items may be waiting out a backoff
        // window — make sure a timer is set so they retry on their own.
        scheduleRetry(queue);
        return;
    }
    if (!navigator.onLine) return;

    // Notify UI we are actively syncing
    window.dispatchEvent(new CustomEvent('novira-sync-started', { detail: { total: pendingItems.length } }));
    broadcast('novira-sync-started', { total: pendingItems.length });

    let done = 0;
    const total = pendingItems.length;

    try {
        for (const item of pendingItems) {
            // Transition to Syncing
            queue = await mutateQueue(q => startSyncing(q, item.id));
            dispatchQueueUpdated(queue);

            try {
                if (item.type === 'ADD_FULL_TRANSACTION') {
                    const { transaction, splitRecords, recurringRecord, hasOfflineReceipt } = item.data;
                    // Use the queue id as idempotency_key so retries dedupe at the RPC layer.
                    const result = await withTimeout(
                        TransactionService.createTransaction({
                            transaction: { ...transaction, idempotency_key: item.id },
                            splits: splitRecords,
                            recurring: recurringRecord,
                            // Never let the service re-queue on our behalf: its offline
                            // fallback answers `success: true` with no row id, which
                            // marked this item synced, orphaned its receipt Blob and
                            // enqueued a duplicate under a new idempotency key.
                            requireOnline: true,
                        }),
                        MUTATION_TIMEOUT_MS,
                        'ADD_FULL_TRANSACTION'
                    );

                    if (result.success) {
                        const realTxId = (result as { data?: { id?: string } }).data?.id;
                        // Use the transaction's user_id over `currentUserId` so a
                        // sign-out racing the sync loop doesn't leave follow-up work skipped.
                        const ownerId = (transaction as { user_id?: string })?.user_id;
                        const idempotent = (result as { idempotent?: boolean }).idempotent;
                        // Upload any queued offline receipt against the freshly-created row.
                        // Failures here don't block markSynced — the transaction is safe on
                        // the server, and the photo is handed to its own retryable queue
                        // item rather than discarded. The Blob is only deleted once it has
                        // actually landed.
                        if (hasOfflineReceipt) {
                            if (realTxId && ownerId) {
                                try {
                                    const blob = await getOfflineReceipt(item.id);
                                    if (!blob) {
                                        // The row is on the server but the photo is
                                        // unrecoverable. Say so — this used to fall through
                                        // to the delete below and vanish silently.
                                        console.error('[sync-manager] queued receipt is gone, expense saved without it', item.id);
                                        window.dispatchEvent(new CustomEvent('novira-receipt-upload-failed', {
                                            detail: { txId: realTxId, queueId: item.id }
                                        }));
                                        broadcast('novira-receipt-upload-failed', { txId: realTxId, queueId: item.id });
                                    }
                                    if (blob) {
                                        const { path } = await withTimeout(
                                            uploadReceipt(ownerId, realTxId, blob),
                                            RECEIPT_UPLOAD_TIMEOUT_MS,
                                            'OFFLINE_RECEIPT_UPLOAD'
                                        );
                                        // `.select()` matters: without it an RLS-filtered
                                        // update answers 204 with no error, so the item was
                                        // marked synced and the Blob deleted while the file
                                        // sat in Storage with nothing pointing at it.
                                        const { data: updated, error: updErr } = await withTimeout(
                                            Promise.resolve(
                                                supabase
                                                    .from('transactions')
                                                    .update({ receipt_path: path })
                                                    .eq('id', realTxId)
                                                    .eq('user_id', ownerId)
                                                    .select('id')
                                            ),
                                            MUTATION_TIMEOUT_MS,
                                            'OFFLINE_RECEIPT_UPDATE'
                                        );
                                        if (updErr) throw updErr;
                                        if (!updated || updated.length === 0) {
                                            throw new Error(`receipt_path update matched no row for transaction ${realTxId}`);
                                        }
                                    }
                                    await deleteOfflineReceipt(item.id);
                                } catch (uploadErr) {
                                    console.warn('[sync-manager] offline receipt upload failed, handing off to retry:', uploadErr);
                                    await handOffReceiptForRetry(item.id, realTxId, ownerId);
                                }
                            } else {
                                // Should not happen: the RPC returns the full row
                                // and user_id is required. Log rather than drop the
                                // photo silently, which is what used to happen.
                                console.error('[sync-manager] cannot upload receipt — missing tx id or owner', { realTxId, ownerId, queueId: item.id });
                            }
                        }
                        queue = await mutateQueue(q => markSynced(q, item.id));
                        window.dispatchEvent(new CustomEvent('novira-mutation-synced', {
                            detail: { id: item.id, type: item.type, data: item.data, result }
                        }));

                        // Notify each split participant once the row is on the server.
                        // Postgres-changes on `splits` isn't reliable for the receiving
                        // user (publication / RLS quirks), so a broadcast guarantees their
                        // "You owe / owed" tiles update without a refresh; the push
                        // fan-out reaches debtors whose app is closed. Skip on idempotent
                        // re-syncs — the row (and its notifications) already went out.
                        if (!idempotent && ownerId && splitRecords && splitRecords.length > 0) {
                            for (const split of splitRecords) {
                                if (!split.user_id || split.user_id === ownerId) continue;
                                const ch = supabase.channel(`split-notify-${split.user_id}`);
                                // SUBSCRIBED fires the broadcast and disposes after `.send`
                                // settles; terminal states dispose immediately. A 5s safety
                                // timer frees the channel even if no status callback fires.
                                let disposed = false;
                                const dispose = () => {
                                    if (disposed) return;
                                    disposed = true;
                                    clearTimeout(safety);
                                    supabase.removeChannel(ch);
                                };
                                const safety = setTimeout(dispose, 5000);
                                ch.subscribe((status) => {
                                    if (status === 'SUBSCRIBED') {
                                        ch.send({
                                            type: 'broadcast',
                                            event: 'split-added',
                                            payload: { fromUserId: ownerId },
                                        }).finally(dispose);
                                    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                                        dispose();
                                    }
                                });
                            }

                            if (realTxId) {
                                fetch('/api/push/notify-split', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ transaction_id: realTxId }),
                                    credentials: 'same-origin',
                                }).catch(() => { /* best-effort */ });
                            }
                        }
                    } else {
                        throw new Error('Failed to create transaction via sync');
                    }
                } else if (item.type === 'UPLOAD_RECEIPT') {
                    // A receipt whose first upload attempt failed. The transaction
                    // itself is already on the server; only the photo is outstanding.
                    const { txId, ownerId } = item.data;
                    const blob = await getOfflineReceipt(item.id);
                    if (!blob) {
                        // Retrying is hopeless — the Blob is gone for good. Fail it
                        // rather than marking it synced: the photo silently vanished
                        // with no user-visible trace, and re-attaching is the only fix.
                        console.error('[sync-manager] UPLOAD_RECEIPT has no stored photo', item.id);
                        queue = await mutateQueue(q => markFailed(
                            q, item.id, 'Receipt photo is no longer available on this device', 'permanent'
                        ));
                        dispatchQueueUpdated(queue);
                    } else {
                        const { path } = await withTimeout(
                            uploadReceipt(ownerId, txId, blob),
                            RECEIPT_UPLOAD_TIMEOUT_MS,
                            'UPLOAD_RECEIPT'
                        );
                        const { data: updated, error } = await withTimeout(
                            Promise.resolve(
                                supabase
                                    .from('transactions')
                                    .update({ receipt_path: path })
                                    .eq('id', txId)
                                    .eq('user_id', ownerId)
                                    .select('id')
                            ),
                            MUTATION_TIMEOUT_MS,
                            'UPLOAD_RECEIPT_UPDATE'
                        );
                        if (error) throw error;
                        if (!updated || updated.length === 0) {
                            throw new Error(`receipt_path update matched no row for transaction ${txId}`);
                        }
                        // Replacing a receipt with a different file type changes the
                        // extension, and the storage path is derived from it — so the
                        // old object is not overwritten by upsert and would leak.
                        const prevPath = item.data?.prevPath;
                        if (prevPath && prevPath !== path) {
                            await deleteReceipt(prevPath).catch(err =>
                                console.warn('[sync-manager] could not remove superseded receipt', err));
                        }
                        await deleteOfflineReceipt(item.id);
                        queue = await mutateQueue(q => markSynced(q, item.id));
                        window.dispatchEvent(new CustomEvent('novira-receipt-uploaded', {
                            detail: { txId, path }
                        }));
                        broadcast('novira-receipt-uploaded', { txId, path });
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
                            console.error(`[sync-manager] ${item.type} permanently failed:`, reason);
                            queue = await mutateQueue(q => markFailed(q, item.id, reason, 'permanent'));
                            window.dispatchEvent(new CustomEvent('novira-mutation-failed-permanent', {
                                detail: { id: item.id, type: item.type, data: item.data, reason }
                            }));
                        } else {
                            throw new Error(reason);
                        }
                    } else {
                        // Postgres treats delete-with-no-match as success (0 rows). That's the
                        // idempotent behavior we want — already-deleted is the same as deleted now.
                        queue = await mutateQueue(q => markSynced(q, item.id));
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
                            console.error(`[sync-manager] ${item.type} permanently failed:`, reason);
                            queue = await mutateQueue(q => markFailed(q, item.id, reason, 'permanent'));
                            window.dispatchEvent(new CustomEvent('novira-mutation-failed-permanent', {
                                detail: { id: item.id, type: item.type, data: item.data, reason }
                            }));
                        } else {
                            throw new Error(reason);
                        }
                    } else {
                        queue = await mutateQueue(q => markSynced(q, item.id));
                        window.dispatchEvent(new CustomEvent('novira-mutation-synced', {
                            detail: { id: item.id, type: item.type, data: item.data }
                        }));
                    }
                } else {
                    // No branch matched. Nothing above would have marked it synced or
                    // thrown, so it would sit 'pending' and be retried forever. Fail it
                    // so it surfaces and can be discarded.
                    console.error('[sync-manager] unknown mutation type, failing it:', item.type);
                    queue = await mutateQueue(q => markFailed(q, item.id, `Unsupported change type: ${item.type}`, 'permanent'));
                    dispatchQueueUpdated(queue);
                }
            } catch (e) {
                // ADD and receipt-upload paths: some errors (RLS, validation, a rejected
                // storage object) are permanent and won't pass on retry. Classify before
                // backing off so the user isn't waiting on hopeless retries — and so the
                // real reason survives instead of being replaced by 'Max retries exceeded'.
                let classifiedReason: string | undefined;
                if (item.type === 'ADD_FULL_TRANSACTION' || item.type === 'UPLOAD_RECEIPT') {
                    const { permanent, reason } = classifyAddError(e);
                    classifiedReason = reason;
                    if (permanent) {
                        console.error(`[sync-manager] ${item.type} permanently failed:`, reason);
                        // Must go through mutateQueue. `markFailed` is a pure function;
                        // assigning its result to the local `queue` persisted nothing, and
                        // the `mutateQueue(removeSynced)` at the end of the pass re-read
                        // fresh state and discarded it. The item stayed 'pending' forever:
                        // it re-ran every pass, failed permanently every pass, and never
                        // reached the failed list where it could be discarded. The pill
                        // read "1 change pending" indefinitely and Sync now did nothing.
                        queue = await mutateQueue(q => markFailed(q, item.id, reason, 'permanent'));
                        dispatchQueueUpdated(queue);
                        window.dispatchEvent(new CustomEvent('novira-mutation-failed-permanent', {
                            detail: { id: item.id, type: item.type, data: item.data, reason }
                        }));
                        done++;
                        window.dispatchEvent(new CustomEvent('novira-sync-progress', { detail: { done, total } }));
                        broadcast('novira-sync-progress', { done, total });
                        continue;
                    }
                }
                // Temporary network/server failure — apply exponential backoff with jitter.
                // Logged unconditionally: this branch was gated on NODE_ENV, so on the
                // deployed build every retryable failure was swallowed with no trace
                // anywhere, which made a phone-only failure impossible to diagnose.
                console.warn(`[sync-manager] ${item.type} failed, will retry:`, e);
                queue = await mutateQueue(q => incrementRetry(q, item.id, classifiedReason ?? getErrorMessage(e)));
            }

            done++;
            window.dispatchEvent(new CustomEvent('novira-sync-progress', { detail: { done, total } }));
            broadcast('novira-sync-progress', { done, total });
        }

        // Clean up
        queue = await mutateQueue(removeSynced);
        dispatchQueueUpdated(queue);

        // Items that hit a transient failure this pass are now pending with a
        // future nextRetryAt — arm a timer so the backoff schedule advances even
        // if the user stays online and idle.
        scheduleRetry(queue);

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
/**
 * Attach (or replace) a receipt on a transaction that is already on the server.
 *
 * Goes through the queue rather than uploading inline so it inherits everything
 * the add-expense path already has: works offline, retries with backoff, and
 * surfaces in the failed-sync list if it never lands. `prevPath` is deleted once
 * the new file is up, but only when the path actually changed.
 */
export async function queueReceiptUpload(
    txId: string,
    ownerId: string,
    file: File | Blob,
    prevPath?: string | null,
): Promise<void> {
    // The Blob and its queue item share one id, so the eviction and expiry sweeps
    // (which delete Blobs by item id) stay correct.
    const id = uuidv4();
    await saveOfflineReceipt(id, file);
    await enqueueMutation('UPLOAD_RECEIPT', { txId, ownerId, prevPath: prevPath ?? null }, { id });
}

/**
 * User-initiated sync. `attemptSync` skips pending items whose `nextRetryAt` is in
 * the future, so during a backoff window (up to 5 minutes) tapping "Sync now" did
 * nothing at all and looked broken. An explicit request clears the backoff first.
 */
export async function syncNow(): Promise<void> {
    const queue = await mutateQueue(q => q.map(item =>
        item.status === 'pending' && item.nextRetryAt
            ? { ...item, nextRetryAt: undefined }
            : item
    ));
    dispatchQueueUpdated(queue);
    clearRetryTimer();
    await attemptSync();
}

export async function retryFailedItem(id: string) {
    const queue = await mutateQueue(q => q.map(item => item.id === id
        ? { ...item, status: 'pending' as const, retryCount: 0, nextRetryAt: undefined, errorReason: undefined, failedAt: undefined, errorKind: undefined }
        : item
    ));
    dispatchQueueUpdated(queue);
    attemptSync();
}

export async function discardFailedItem(id: string) {
    const queue = await mutateQueue(q => q.filter(item => item.id !== id));
    dispatchQueueUpdated(queue);
    // Drop any orphaned offline receipt for this item — keeps IDB clean even
    // for queue types that never had a receipt (no-op when key is absent).
    deleteOfflineReceipt(id);
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

    // iOS suspends timers while the tab is backgrounded — which is exactly what the
    // OS photo picker does — so a backoff schedule can lapse with nothing left to
    // restart it until the next cold start. Re-drive the queue on foreground.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine) attemptSync();
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
                case 'novira-receipt-uploaded':
                    window.dispatchEvent(new CustomEvent('novira-receipt-uploaded', { detail: msg.payload }));
                    break;
                case 'novira-receipt-upload-failed':
                    window.dispatchEvent(new CustomEvent('novira-receipt-upload-failed', { detail: msg.payload }));
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
