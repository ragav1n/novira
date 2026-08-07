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
    createSerializedMutator,
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

describe('createSerializedMutator', () => {
    /**
     * Stand-in for the IndexedDB-backed queue whose reads park until explicitly
     * released. Timing-based delays aren't a valid test here: two setTimeout reads
     * of equal length drain their continuations between timer callbacks, so they
     * serialize by accident and an unserialized mutator would pass. Parking every
     * read makes the overlap deterministic — release the world and see how many
     * reads were in flight against the same stale snapshot.
     */
    function makeGatedStore(initial: SyncPayload[] = []) {
        let stored: SyncPayload[] = [...initial];
        let parked: Array<() => void> = [];
        return {
            get current() { return stored; },
            read: () => new Promise<SyncPayload[]>(resolve => {
                parked.push(() => resolve([...stored]));
            }),
            write: async (q: SyncPayload[]) => { stored = [...q]; },
            releaseAll() {
                const batch = parked;
                parked = [];
                batch.forEach(fn => fn());
            },
            /** Release parked reads until every in-flight mutation has settled. */
            async drain(settled: Promise<unknown>) {
                let done = false;
                settled.then(() => { done = true }, () => { done = true });
                for (let i = 0; i < 50 && !done; i++) {
                    this.releaseAll();
                    await new Promise(r => setTimeout(r, 0));
                }
                return settled;
            },
        };
    }

    it('does not lose a mutation enqueued while another is mid-flight', async () => {
        // The sync-loop clobber: the loop held a queue snapshot across its RPC
        // await, so an expense added in that window was overwritten on write-back
        // and vanished with no error. An unserialized mutator resolves both reads
        // from the same snapshot here and drops one of the two changes.
        const store = makeGatedStore();
        const mutate = createSerializedMutator(store.read, store.write);

        await store.drain(mutate(q => addToQueue(q, { id: 'in-flight', type: 'ADD_TX', data: {} })));

        const both = Promise.all([
            mutate(q => markSynced(q, 'in-flight')),
            mutate(q => addToQueue(q, { id: 'added-during-sync', type: 'ADD_TX', data: {} })),
        ]);
        await store.drain(both);

        expect(store.current.map(i => i.id)).toEqual(['in-flight', 'added-during-sync']);
        expect(store.current.find(i => i.id === 'in-flight')?.status).toBe('synced');
        expect(store.current.find(i => i.id === 'added-during-sync')?.status).toBe('pending');
    });

    it('applies every concurrent mutation exactly once', async () => {
        const store = makeGatedStore();
        const mutate = createSerializedMutator(store.read, store.write);

        const all = Promise.all(
            Array.from({ length: 25 }, (_, i) =>
                mutate(q => addToQueue(q, { id: `item-${i}`, type: 'ADD_TX', data: {} }))
            )
        );
        await store.drain(all);

        expect(store.current).toHaveLength(25);
        expect(new Set(store.current.map(i => i.id)).size).toBe(25);
    });

    it('resolves each call with the queue state produced by that call', async () => {
        const store = makeGatedStore();
        const mutate = createSerializedMutator(store.read, store.write);

        const first = mutate(q => addToQueue(q, { id: 'a', type: 'ADD_TX', data: {} }));
        const second = mutate(q => addToQueue(q, { id: 'b', type: 'ADD_TX', data: {} }));
        await store.drain(Promise.all([first, second]));

        expect((await first).map(i => i.id)).toEqual(['a']);
        expect((await second).map(i => i.id)).toEqual(['a', 'b']);
    });

    it('surfaces a failed write to its caller without wedging later mutations', async () => {
        const store = makeGatedStore();
        let failNext = true;
        const write = async (q: SyncPayload[]) => {
            if (failNext) { failNext = false; throw new Error('quota exceeded'); }
            await store.write(q);
        };
        const mutate = createSerializedMutator(store.read, write);

        const doomed = mutate(q => addToQueue(q, { id: 'doomed', type: 'ADD_TX', data: {} }));
        await expect(store.drain(doomed)).rejects.toThrow('quota exceeded');

        const ok = mutate(q => addToQueue(q, { id: 'ok', type: 'ADD_TX', data: {} }));
        await store.drain(ok);
        expect((await ok).map(i => i.id)).toEqual(['ok']);
        expect(store.current.map(i => i.id)).toEqual(['ok']);
    });
});
