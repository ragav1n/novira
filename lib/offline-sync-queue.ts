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
