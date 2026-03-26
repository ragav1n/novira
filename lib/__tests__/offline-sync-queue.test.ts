import { describe, it, expect, beforeEach } from 'vitest';
import {
    addToQueue,
    startSyncing,
    markSynced,
    markFailed,
    resetToPending,
    removeSynced,
    incrementRetry,
    type SyncPayload,
} from '../offline-sync-queue';

describe('offline sync queue state machine', () => {
    let queue: SyncPayload[] = [];

    beforeEach(() => {
        queue = [];
    });

    describe('addToQueue', () => {
        it('adds an item with pending status', () => {
            queue = addToQueue(queue, { id: 'uuid-1', type: 'ADD_TX', data: { amount: 5 } });
            expect(queue).toHaveLength(1);
            expect(queue[0].status).toBe('pending');
            expect(queue[0].retryCount).toBe(0);
            expect(queue[0].createdAt).toBeGreaterThan(0);
        });

        it('does not mutate the original queue', () => {
            const original = addToQueue([], { id: 'uuid-1', type: 'ADD_TX', data: {} });
            const updated = addToQueue(original, { id: 'uuid-2', type: 'ADD_TX', data: {} });
            expect(original).toHaveLength(1);
            expect(updated).toHaveLength(2);
        });

        it('preserves existing items when adding a new one', () => {
            queue = addToQueue(queue, { id: 'uuid-1', type: 'ADD_TX', data: {} });
            queue = addToQueue(queue, { id: 'uuid-2', type: 'DELETE_TX', data: {} });
            expect(queue).toHaveLength(2);
            expect(queue[0].id).toBe('uuid-1');
            expect(queue[1].id).toBe('uuid-2');
        });
    });

    describe('startSyncing', () => {
        it('changes status to syncing for the target item', () => {
            queue = addToQueue(queue, { id: 'uuid-1', type: 'ADD_TX', data: {} });
            queue = startSyncing(queue, 'uuid-1');
            expect(queue[0].status).toBe('syncing');
        });

        it('does not change other items', () => {
            queue = addToQueue(queue, { id: 'uuid-1', type: 'ADD_TX', data: {} });
            queue = addToQueue(queue, { id: 'uuid-2', type: 'ADD_TX', data: {} });
            queue = startSyncing(queue, 'uuid-1');
            expect(queue[1].status).toBe('pending');
        });
    });

    describe('markSynced', () => {
        it('marks item as synced', () => {
            queue = addToQueue(queue, { id: 'uuid-1', type: 'ADD_TX', data: {} });
            queue = startSyncing(queue, 'uuid-1');
            queue = markSynced(queue, 'uuid-1');
            expect(queue[0].status).toBe('synced');
        });
    });

    describe('markFailed', () => {
        it('marks item as failed with reason and timestamp', () => {
            queue = addToQueue(queue, { id: 'uuid-1', type: 'ADD_TX', data: {} });
            const before = Date.now();
            queue = markFailed(queue, 'uuid-1', 'Schema mismatch');
            expect(queue[0].status).toBe('failed');
            expect(queue[0].errorReason).toBe('Schema mismatch');
            expect(queue[0].failedAt).toBeGreaterThanOrEqual(before);
        });
    });

    describe('resetToPending', () => {
        it('resets a failed item back to pending and clears error info', () => {
            queue = addToQueue(queue, { id: 'uuid-1', type: 'ADD_TX', data: {} });
            queue = markFailed(queue, 'uuid-1', 'Some error');
            queue = resetToPending(queue, 'uuid-1');
            expect(queue[0].status).toBe('pending');
            expect(queue[0].errorReason).toBeUndefined();
            expect(queue[0].failedAt).toBeUndefined();
        });
    });

    describe('removeSynced', () => {
        it('removes all synced items', () => {
            queue = addToQueue(queue, { id: 'uuid-1', type: 'ADD_TX', data: {} });
            queue = addToQueue(queue, { id: 'uuid-2', type: 'ADD_TX', data: {} });
            queue = markSynced(queue, 'uuid-1');
            queue = removeSynced(queue);
            expect(queue).toHaveLength(1);
            expect(queue[0].id).toBe('uuid-2');
        });

        it('keeps pending and failed items', () => {
            queue = addToQueue(queue, { id: 'uuid-1', type: 'ADD_TX', data: {} });
            queue = addToQueue(queue, { id: 'uuid-2', type: 'ADD_TX', data: {} });
            queue = markFailed(queue, 'uuid-2', 'error');
            queue = removeSynced(queue);
            expect(queue).toHaveLength(2);
        });

        it('returns empty queue when all items are synced', () => {
            queue = addToQueue(queue, { id: 'uuid-1', type: 'ADD_TX', data: {} });
            queue = markSynced(queue, 'uuid-1');
            queue = removeSynced(queue);
            expect(queue).toHaveLength(0);
        });
    });

    describe('incrementRetry with exponential backoff', () => {
        it('keeps status pending and increments retryCount on first retry', () => {
            queue = addToQueue(queue, { id: 'uuid-1', type: 'ADD_TX', data: {} });
            const before = Date.now();
            queue = incrementRetry(queue, 'uuid-1');
            expect(queue[0].status).toBe('pending');
            expect(queue[0].retryCount).toBe(1);
            expect(queue[0].nextRetryAt).toBeGreaterThan(before);
        });

        it('applies ~2s backoff on first retry', () => {
            queue = addToQueue(queue, { id: 'uuid-1', type: 'ADD_TX', data: {} });
            const before = Date.now();
            queue = incrementRetry(queue, 'uuid-1');
            expect(queue[0].nextRetryAt).toBeLessThanOrEqual(before + 2000 + 100);
        });

        it('applies ~4s backoff on second retry', () => {
            queue = addToQueue(queue, { id: 'uuid-1', type: 'ADD_TX', data: {} });
            const before = Date.now();
            queue = incrementRetry(queue, 'uuid-1');
            queue = incrementRetry(queue, 'uuid-1');
            expect(queue[0].retryCount).toBe(2);
            expect(queue[0].nextRetryAt).toBeGreaterThanOrEqual(before + 4000 - 100);
        });

        it('marks as failed after 5 retries (max)', () => {
            queue = addToQueue(queue, { id: 'uuid-1', type: 'ADD_TX', data: {} });
            for (let i = 0; i < 5; i++) {
                queue = incrementRetry(queue, 'uuid-1');
            }
            expect(queue[0].status).toBe('failed');
            expect(queue[0].retryCount).toBe(5);
            expect(queue[0].errorReason).toBe('Max retries exceeded');
        });

        it('doubles backoff on each retry (exponential)', () => {
            queue = addToQueue(queue, { id: 'uuid-1', type: 'ADD_TX', data: {} });
            const t0 = Date.now();
            queue = incrementRetry(queue, 'uuid-1'); // retry 1: ~2s
            const after1 = queue[0].nextRetryAt!;
            queue = incrementRetry(queue, 'uuid-1'); // retry 2: ~4s
            const after2 = queue[0].nextRetryAt!;
            // Each successive retry should have a longer nextRetryAt
            expect(after2).toBeGreaterThan(after1);
        });
    });

    describe('full lifecycle', () => {
        it('runs through the complete pending → syncing → synced → removed flow', () => {
            queue = addToQueue(queue, { id: 'uuid-1', type: 'ADD_TX', data: { amount: 100 } });
            expect(queue[0].status).toBe('pending');

            queue = startSyncing(queue, 'uuid-1');
            expect(queue[0].status).toBe('syncing');

            queue = markSynced(queue, 'uuid-1');
            expect(queue[0].status).toBe('synced');

            queue = removeSynced(queue);
            expect(queue).toHaveLength(0);
        });

        it('runs through the failed → reset → re-sync flow', () => {
            queue = addToQueue(queue, { id: 'uuid-1', type: 'ADD_TX', data: {} });
            queue = markFailed(queue, 'uuid-1', 'Network timeout');
            queue = resetToPending(queue, 'uuid-1');
            queue = startSyncing(queue, 'uuid-1');
            queue = markSynced(queue, 'uuid-1');
            queue = removeSynced(queue);
            expect(queue).toHaveLength(0);
        });
    });
});
