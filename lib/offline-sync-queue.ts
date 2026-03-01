export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface SyncPayload {
    id: string; // Idempotency key (UUID generated at creation)
    type: string; // e.g. 'ADD_TRANSACTION', 'DELETE_TRANSACTION'
    data: any; // payload data for the API request
    status: SyncStatus;
    createdAt: number;
    errorReason?: string;
    failedAt?: number;
}

/**
 * Pure functions mapping out the exact state machine for Offline IndexedDB Queues.
 * These transitions are strictly detached from React/IndexedDB boundaries.
 */

export function addToQueue(queue: SyncPayload[], payload: Omit<SyncPayload, 'status' | 'createdAt'>): SyncPayload[] {
    return [...queue, { ...payload, status: 'pending', createdAt: Date.now() }];
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
