import { get, set } from 'idb-keyval';
import { supabase } from '@/lib/supabase';
import {
    SyncPayload,
    addToQueue,
    startSyncing,
    markSynced,
    markFailed,
    incrementRetry,
    removeSynced
} from './offline-sync-queue';
import { TransactionService } from './services/transaction-service';

const QUEUE_KEY = 'novira-offline-queue';
let isSyncingLoopActive = false;

function uuidv4() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
        (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
    );
}

// 1. Enqueue Function
export async function enqueueMutation(type: string, data: any): Promise<string> {
    const currentQueue = (await get<SyncPayload[]>(QUEUE_KEY)) || [];
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

// 2. Head Probe Health Check
async function isSupabaseHealthy(): Promise<boolean> {
    if (!navigator.onLine) return false;
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return false;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/`, {
            method: 'HEAD',
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response.ok;
    } catch (error) {
        clearTimeout(timeoutId);
        return false;
    }
}

// 3. Process the Queue
export async function attemptSync() {
    if (isSyncingLoopActive) return;
    
    let queue = (await get<SyncPayload[]>(QUEUE_KEY)) || [];
    // Migrate legacy items that don't have retryCount
    queue = queue.map(item => ({ ...item, retryCount: item.retryCount ?? 0 }));
    const now = Date.now();
    const pendingItems = queue.filter(item =>
        item.status === 'pending' &&
        (!item.nextRetryAt || item.nextRetryAt <= now)
    );
    
    if (pendingItems.length === 0) return;

    isSyncingLoopActive = true;

    const healthy = await isSupabaseHealthy();
    if (!healthy) {
        isSyncingLoopActive = false;
        return;
    }

    // Notify UI we are actively syncing
    window.dispatchEvent(new Event('novira-sync-started'));

    try {
        for (const item of pendingItems) {
            // Transition to Syncing
            queue = startSyncing(queue, item.id);
        await set(QUEUE_KEY, queue);
        window.dispatchEvent(new CustomEvent('novira-queue-updated', { detail: { queue } }));

        try {
            // Execute mutation based on Type
            if (item.type === 'ADD_FULL_TRANSACTION') {
                const { transaction, splitRecords, recurringRecord } = item.data;
                
                // Use the Service method which now uses the RPC
                // We pass the transaction as is, but ensuring idempotency_key is present (it should be from enqueue)
                const result = await TransactionService.createTransaction({
                    transaction: { ...transaction, idempotency_key: item.id },
                    splits: splitRecords,
                    recurring: recurringRecord
                });

                if (result.success) {
                    queue = markSynced(queue, item.id);
                } else {
                    // This block might not be reachable if createTransaction throws, but keeping for safety
                    throw new Error("Failed to create transaction via sync");
                }
            } else if (item.type === 'DELETE_TRANSACTION') {
                const { error, status } = await supabase
                    .from('transactions')
                    .delete()
                    .eq('id', item.data.id);
                
                if (error) {
                    if (status >= 400 && status < 500) {
                        queue = markFailed(queue, item.id, error.message);
                    } else {
                        throw new Error("Temporary failure");
                    }
                } else {
                    queue = markSynced(queue, item.id);
                }
            }
            // Add other types as needed
            
        } catch (e) {
            // Temporary network failure — apply exponential backoff
            queue = incrementRetry(queue, item.id);
        }

        await set(QUEUE_KEY, queue);
        }

        // Clean up
        queue = removeSynced(queue);
        await set(QUEUE_KEY, queue);
        window.dispatchEvent(new CustomEvent('novira-queue-updated', { detail: { queue } }));
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
