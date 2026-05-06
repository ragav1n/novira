export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface SyncPayload {
    id: string; // Idempotency key (UUID generated at creation)
    type: string; // e.g. 'ADD_TRANSACTION', 'DELETE_TRANSACTION'
    data: any; // payload data for the API request
    status: SyncStatus;
    createdAt: number;
    retryCount: number;
    nextRetryAt?: number; // timestamp — skip item until this time passes
    errorReason?: string;
    failedAt?: number;
}

/**
 * Pure functions mapping out the exact state machine for Offline IndexedDB Queues.
 * These transitions are strictly detached from React/IndexedDB boundaries.
 */

export function addToQueue(queue: SyncPayload[], payload: Omit<SyncPayload, 'status' | 'createdAt' | 'retryCount'>): SyncPayload[] {
    return [...queue, { ...payload, status: 'pending', createdAt: Date.now(), retryCount: 0 }];
}

const MAX_RETRIES = 5;
export const MAX_QUEUE_SIZE = 500;
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function incrementRetry(queue: SyncPayload[], id: string): SyncPayload[] {
    return queue.map(item => {
        if (item.id !== id) return item;
        const retryCount = (item.retryCount ?? 0) + 1;
        if (retryCount >= MAX_RETRIES) {
            return { ...item, status: 'failed', retryCount, errorReason: 'Max retries exceeded', failedAt: Date.now() };
        }
        // Exponential backoff: 2s, 4s, 8s, 16s, capped at 5 min, with ±15% jitter
        // to avoid thundering herd when many clients retry after a server outage.
        const baseMs = Math.min(1000 * Math.pow(2, retryCount), 5 * 60 * 1000);
        const jitter = 0.85 + Math.random() * 0.3;
        const backoffMs = Math.round(baseMs * jitter);
        return { ...item, status: 'pending', retryCount, nextRetryAt: Date.now() + backoffMs };
    });
}

/**
 * Evict the oldest failed items first, then oldest pending items, until queue
 * fits within MAX_QUEUE_SIZE - 1 (leaving room for one new enqueue).
 * Items currently 'syncing' are never evicted.
 */
export function evictForCapacity(queue: SyncPayload[]): SyncPayload[] {
    if (queue.length < MAX_QUEUE_SIZE) return queue;
    const sortedFailed = queue.filter(i => i.status === 'failed').sort((a, b) => a.createdAt - b.createdAt);
    const sortedPending = queue.filter(i => i.status === 'pending').sort((a, b) => a.createdAt - b.createdAt);
    const evictionOrder = [...sortedFailed, ...sortedPending];
    const toRemove = new Set<string>();
    let remaining = queue.length;
    for (const item of evictionOrder) {
        if (remaining < MAX_QUEUE_SIZE) break;
        toRemove.add(item.id);
        remaining--;
    }
    return queue.filter(i => !toRemove.has(i.id));
}

export function startSyncing(queue: SyncPayload[], id: string): SyncPayload[] {
    return queue.map(item => item.id === id ? { ...item, status: 'syncing' } : item);
}

export function markSynced(queue: SyncPayload[], id: string): SyncPayload[] {
    return queue.map(item => item.id === id ? { ...item, status: 'synced' } : item);
}

export function markFailed(queue: SyncPayload[], id: string, reason: string): SyncPayload[] {
    return queue.map(item => item.id === id ? { 
        ...item, 
        status: 'failed', 
        errorReason: reason, 
        failedAt: Date.now() 
    } : item);
}

export function resetToPending(queue: SyncPayload[], id: string): SyncPayload[] {
    return queue.map(item => item.id === id ? { 
        ...item, 
        status: 'pending', 
        errorReason: undefined, 
        failedAt: undefined 
    } : item);
}

export function removeSynced(queue: SyncPayload[]): SyncPayload[] {
    return queue.filter(item => item.status !== 'synced');
}

/**
 * Mark items older than MAX_AGE_MS as failed so they stop retrying forever and
 * surface to the user (the failed list is shown in the sync indicator UI).
 * Items currently 'syncing' are left alone — the in-flight request decides.
 */
export function expireStaleItems(queue: SyncPayload[], now = Date.now()): SyncPayload[] {
    let changed = false;
    const next = queue.map(item => {
        if (item.status !== 'pending') return item;
        if (now - item.createdAt < MAX_AGE_MS) return item;
        changed = true;
        return {
            ...item,
            status: 'failed' as const,
            errorReason: 'Expired (older than 7 days)',
            failedAt: now,
        };
    });
    return changed ? next : queue;
}

/**
 * Find a pending duplicate that should suppress a new enqueue.
 * Only DELETE_TRANSACTION dedupes by exact tx id — duplicates are pure waste.
 * UPDATE_TRANSACTION uses mergeUpdatePatch instead so newer patches win.
 * ADD_FULL_TRANSACTION never dedupes (every add is a distinct new row).
 */
export function findPendingDuplicate(
    queue: SyncPayload[],
    type: string,
    data: { id?: string }
): SyncPayload | undefined {
    if (type !== 'DELETE_TRANSACTION') return undefined;
    if (!data?.id) return undefined;
    return queue.find(item =>
        item.type === type &&
        (item.status === 'pending' || item.status === 'syncing') &&
        item.data?.id === data.id
    );
}

/**
 * Merge a newer UPDATE_TRANSACTION patch into a pending one for the same row.
 * Returns the new queue and the merged item id, or null if no merge happened.
 */
export function mergePendingUpdate(
    queue: SyncPayload[],
    data: { id: string; patch: Record<string, unknown> }
): { queue: SyncPayload[]; mergedId: string } | null {
    const idx = queue.findIndex(item =>
        item.type === 'UPDATE_TRANSACTION' &&
        item.status === 'pending' &&
        item.data?.id === data.id
    );
    if (idx === -1) return null;
    const existing = queue[idx];
    const next = [...queue];
    next[idx] = {
        ...existing,
        data: { id: data.id, patch: { ...existing.data?.patch, ...data.patch } },
    };
    return { queue: next, mergedId: existing.id };
}
