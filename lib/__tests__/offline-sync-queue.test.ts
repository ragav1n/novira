import { describe, it, expect, beforeEach } from 'vitest';
import {
    addToQueue,
    startSyncing,
    markSynced,
    markFailed,
    resetToPending,
    removeSynced,
    incrementRetry,
    evictForCapacity,
    expireStaleItems,
    MAX_QUEUE_SIZE,
    MAX_AGE_MS,
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
        it('marks item as failed with reason, timestamp, and permanent errorKind by default', () => {
            queue = addToQueue(queue, { id: 'uuid-1', type: 'ADD_TX', data: {} });
            const before = Date.now();
            queue = markFailed(queue, 'uuid-1', 'Schema mismatch');
            expect(queue[0].status).toBe('failed');
            expect(queue[0].errorReason).toBe('Schema mismatch');
            expect(queue[0].failedAt).toBeGreaterThanOrEqual(before);
            expect(queue[0].errorKind).toBe('permanent');
        });

        it('honors an explicit errorKind override', () => {
            queue = addToQueue(queue, { id: 'uuid-1', type: 'ADD_TX', data: {} });
            queue = markFailed(queue, 'uuid-1', 'Network down', 'transient');
            expect(queue[0].errorKind).toBe('transient');
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
            expect(queue[0].errorKind).toBeUndefined();
        });
    });

    describe('expireStaleItems', () => {
        it('marks pending items older than MAX_AGE_MS as failed with errorKind=expired', () => {
            const now = Date.now();
            const stale: SyncPayload = {
                id: 'stale-1', type: 'ADD_TX', data: {}, status: 'pending',
                createdAt: now - MAX_AGE_MS - 1000, retryCount: 0,
            };
            const fresh: SyncPayload = {
                id: 'fresh-1', type: 'ADD_TX', data: {}, status: 'pending',
                createdAt: now, retryCount: 0,
            };
            const next = expireStaleItems([stale, fresh], now);
            expect(next[0].status).toBe('failed');
            expect(next[0].errorKind).toBe('expired');
            expect(next[0].errorReason).toMatch(/Expired/);
            expect(next[1].status).toBe('pending');
        });

        it('returns the same reference when nothing changed', () => {
            const now = Date.now();
            const fresh: SyncPayload = {
                id: 'fresh-1', type: 'ADD_TX', data: {}, status: 'pending',
                createdAt: now, retryCount: 0,
            };
            const input = [fresh];
            expect(expireStaleItems(input, now)).toBe(input);
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

        it('applies ~2s backoff on first retry (within ±15% jitter)', () => {
            queue = addToQueue(queue, { id: 'uuid-1', type: 'ADD_TX', data: {} });
            const before = Date.now();
            queue = incrementRetry(queue, 'uuid-1');
            // Base = 2000ms; jitter window = 0.85x..1.15x = 1700ms..2300ms
            expect(queue[0].nextRetryAt).toBeGreaterThanOrEqual(before + 1700 - 50);
            expect(queue[0].nextRetryAt).toBeLessThanOrEqual(before + 2300 + 50);
        });

        it('applies ~4s backoff on second retry (within ±15% jitter)', () => {
            queue = addToQueue(queue, { id: 'uuid-1', type: 'ADD_TX', data: {} });
            queue = incrementRetry(queue, 'uuid-1'); // retry 1
            const before = Date.now();
            queue = incrementRetry(queue, 'uuid-1'); // retry 2
            expect(queue[0].retryCount).toBe(2);
            // Base = 4000ms; jitter window = 3400ms..4600ms
            expect(queue[0].nextRetryAt).toBeGreaterThanOrEqual(before + 3400 - 50);
            expect(queue[0].nextRetryAt).toBeLessThanOrEqual(before + 4600 + 50);
        });

        it('produces non-deterministic backoff (jitter)', () => {
            // 20 independent first-retries should not all land on the exact same nextRetryAt
            const samples: number[] = [];
            for (let i = 0; i < 20; i++) {
                let q = addToQueue([], { id: `uuid-${i}`, type: 'ADD_TX', data: {} });
                q = incrementRetry(q, `uuid-${i}`);
                samples.push(q[0].nextRetryAt!);
            }
            const distinct = new Set(samples);
            expect(distinct.size).toBeGreaterThan(1);
        });

        it('marks as failed after 5 retries (max) with transient errorKind', () => {
            queue = addToQueue(queue, { id: 'uuid-1', type: 'ADD_TX', data: {} });
            for (let i = 0; i < 5; i++) {
                queue = incrementRetry(queue, 'uuid-1');
            }
            expect(queue[0].status).toBe('failed');
            expect(queue[0].retryCount).toBe(5);
            expect(queue[0].errorReason).toBe('Max retries exceeded');
            expect(queue[0].errorKind).toBe('transient');
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

    describe('evictForCapacity', () => {
        function buildSaturatedQueue(failed: number, pending: number, syncing: number): SyncPayload[] {
            const q: SyncPayload[] = [];
            let t = 1000;
            for (let i = 0; i < failed; i++) {
                q.push({ id: `f-${i}`, type: 'ADD_TX', data: {}, status: 'failed', createdAt: t++, retryCount: 5 });
            }
            for (let i = 0; i < pending; i++) {
                q.push({ id: `p-${i}`, type: 'ADD_TX', data: {}, status: 'pending', createdAt: t++, retryCount: 0 });
            }
            for (let i = 0; i < syncing; i++) {
                q.push({ id: `s-${i}`, type: 'ADD_TX', data: {}, status: 'syncing', createdAt: t++, retryCount: 0 });
            }
            return q;
        }

        it('returns the queue unchanged when below capacity', () => {
            const q = buildSaturatedQueue(0, 10, 0);
            expect(evictForCapacity(q)).toBe(q);
        });

        it('evicts oldest failed items first when at capacity', () => {
            const q = buildSaturatedQueue(MAX_QUEUE_SIZE, 0, 0);
            const evicted = evictForCapacity(q);
            expect(evicted.length).toBe(MAX_QUEUE_SIZE - 1);
            // Oldest (lowest createdAt) failed item should be removed
            expect(evicted.some(i => i.id === 'f-0')).toBe(false);
        });

        it('falls back to evicting pending items when no failed items remain', () => {
            const q = buildSaturatedQueue(0, MAX_QUEUE_SIZE, 0);
            const evicted = evictForCapacity(q);
            expect(evicted.length).toBe(MAX_QUEUE_SIZE - 1);
            expect(evicted.some(i => i.id === 'p-0')).toBe(false);
        });

        it('never evicts syncing items', () => {
            const q = buildSaturatedQueue(0, 0, MAX_QUEUE_SIZE);
            const evicted = evictForCapacity(q);
            // All items are 'syncing' — none should be removed even though we're at capacity
            expect(evicted.length).toBe(MAX_QUEUE_SIZE);
            expect(evicted.every(i => i.status === 'syncing')).toBe(true);
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
