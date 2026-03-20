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

export function incrementRetry(queue: SyncPayload[], id: string): SyncPayload[] {
    return queue.map(item => {
        if (item.id !== id) return item;
        const retryCount = (item.retryCount ?? 0) + 1;
        if (retryCount >= MAX_RETRIES) {
            return { ...item, status: 'failed', retryCount, errorReason: 'Max retries exceeded', failedAt: Date.now() };
        }
        // Exponential backoff: 2s, 4s, 8s, 16s, capped at 5 min
        const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 5 * 60 * 1000);
        return { ...item, status: 'pending', retryCount, nextRetryAt: Date.now() + backoffMs };
    });
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
