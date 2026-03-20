import { addToQueue, startSyncing, markSynced, markFailed, resetToPending, removeSynced, incrementRetry, SyncPayload } from '../offline-sync-queue';
import * as assert from 'assert';

console.log("Running offline sync queue unit tests...");

let queue: SyncPayload[] = [];

// 1. Add to pending
queue = addToQueue(queue, { id: 'uuid-1', type: 'ADD_TX', data: { amount: 5 } });
assert.strictEqual(queue.length, 1);
assert.strictEqual(queue[0].status, 'pending');
assert.strictEqual(queue[0].retryCount, 0);
assert.ok(queue[0].createdAt > 0);

// 2. Start syncing
queue = startSyncing(queue, 'uuid-1');
assert.strictEqual(queue[0].status, 'syncing');

// 3. Mark failed (e.g., Supabase 400 Bad Request)
queue = markFailed(queue, 'uuid-1', 'Schema mismatch');
assert.strictEqual(queue[0].status, 'failed');
assert.strictEqual(queue[0].errorReason, 'Schema mismatch');
assert.ok(queue[0].failedAt !== undefined);

// 4. Reset to pending (e.g., User taps "Retry" in dead-letter queue UI)
queue = resetToPending(queue, 'uuid-1');
assert.strictEqual(queue[0].status, 'pending');
assert.strictEqual(queue[0].errorReason, undefined);
assert.strictEqual(queue[0].failedAt, undefined);

// 5. Sync again and mark synced (e.g., Network recovers)
queue = startSyncing(queue, 'uuid-1');
queue = markSynced(queue, 'uuid-1');
assert.strictEqual(queue[0].status, 'synced');

// 6. Clean up synced items
queue = removeSynced(queue);
assert.strictEqual(queue.length, 0);

// 7. incrementRetry — exponential backoff up to max retries
let retryQueue: SyncPayload[] = [];
retryQueue = addToQueue(retryQueue, { id: 'uuid-2', type: 'ADD_TX', data: {} });

// First retry: status stays pending, retryCount=1, nextRetryAt set (~2s)
const before = Date.now();
retryQueue = incrementRetry(retryQueue, 'uuid-2');
assert.strictEqual(retryQueue[0].status, 'pending');
assert.strictEqual(retryQueue[0].retryCount, 1);
assert.ok((retryQueue[0].nextRetryAt ?? 0) > before);
assert.ok((retryQueue[0].nextRetryAt ?? 0) <= before + 2000 + 100); // ~2s backoff

// Second retry: ~4s backoff
retryQueue = incrementRetry(retryQueue, 'uuid-2');
assert.strictEqual(retryQueue[0].retryCount, 2);
assert.ok((retryQueue[0].nextRetryAt ?? 0) >= before + 4000 - 100);

// Retry until max (5 retries) — should become failed
retryQueue = addToQueue([], { id: 'uuid-3', type: 'ADD_TX', data: {} });
for (let i = 0; i < 5; i++) retryQueue = incrementRetry(retryQueue, 'uuid-3');
assert.strictEqual(retryQueue[0].status, 'failed');
assert.strictEqual(retryQueue[0].retryCount, 5);
assert.ok(retryQueue[0].errorReason !== undefined);

// 8. incrementRetry caps backoff at 5 minutes
retryQueue = addToQueue([], { id: 'uuid-4', type: 'ADD_TX', data: {} });
retryQueue[0] = { ...retryQueue[0], retryCount: 10 }; // simulate high retry count
retryQueue = incrementRetry(retryQueue, 'uuid-4');
const fiveMinutes = 5 * 60 * 1000;
assert.ok((retryQueue[0].nextRetryAt ?? 0) <= Date.now() + fiveMinutes + 100);

console.log("All offline sync queue state machine tests passed successfully! ✅");
