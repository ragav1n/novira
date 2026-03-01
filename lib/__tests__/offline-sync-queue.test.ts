import { addToQueue, startSyncing, markSynced, markFailed, resetToPending, removeSynced, SyncPayload } from '../offline-sync-queue';
import * as assert from 'assert';

console.log("Running offline sync queue unit tests...");

let queue: SyncPayload[] = [];

// 1. Add to pending
queue = addToQueue(queue, { id: 'uuid-1', type: 'ADD_TX', data: { amount: 5 } });
assert.strictEqual(queue.length, 1);
assert.strictEqual(queue[0].status, 'pending');
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

console.log("All offline sync queue state machine tests passed successfully! ✅");
