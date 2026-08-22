import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Source-level guard for a bug that shipped for three months.
 *
 * The state-machine helpers in offline-sync-queue.ts are PURE — they return a new
 * array and persist nothing. One call site did
 *
 *     queue = markFailed(queue, item.id, reason, 'permanent');
 *
 * instead of `await mutateQueue(q => markFailed(...))`. It assigned to a local
 * variable, and `mutateQueue(removeSynced)` at the end of the pass re-read fresh
 * state and discarded it. So an ADD that failed permanently stayed 'pending'
 * forever: retried every pass, failed every pass, never reaching the failed list.
 * The UI read "1 change pending" indefinitely and "Sync now" did nothing.
 *
 * Nothing else catches this — it type-checks, and every unit test passes, because
 * the pure function itself is correct.
 */
const SOURCE = readFileSync(resolve(__dirname, '../sync-manager.ts'), 'utf8');

/**
 * Only the PER-ITEM transitions. The whole-queue sweeps (evictForCapacity,
 * expireStaleItems, resetStaleSyncing) are legitimately called bare — as a
 * cheap pre-check to avoid a pointless write, and from inside a mutateQueue
 * callback where the enclosing call does the persisting.
 *
 * The check is line-scoped and deliberately strict: every one of these is a
 * one-liner today. A future multi-line mutateQueue callback would trip it, and
 * updating this list is the right response to that.
 */
const TRANSITIONS = [
    'markSynced',
    'markFailed',
    'incrementRetry',
    'resetToPending',
] as const;

describe('sync-manager persists every queue transition', () => {
    it.each(TRANSITIONS)('%s is only ever called inside mutateQueue', (fn) => {
        const offenders = SOURCE.split('\n')
            .map((line, i) => ({ line: line.trim(), no: i + 1 }))
            .filter(({ line }) => new RegExp(`(^|[^\\w.])${fn}\\s*\\(`).test(line))
            // the import block lists the names without calling them
            .filter(({ line }) => !line.startsWith('import') && !/^\w+,$/.test(line))
            .filter(({ line }) => !line.includes('mutateQueue('));

        expect(
            offenders.map(o => `line ${o.no}: ${o.line}`),
            `${fn}() must be wrapped in mutateQueue() or its result is never written to IndexedDB`,
        ).toEqual([]);
    });

    it('has a fallback branch so an unknown mutation type cannot loop forever', () => {
        // Without a final else, an item whose type matches no branch is neither
        // marked synced nor thrown — it stays pending and is retried indefinitely.
        expect(SOURCE).toMatch(/unknown mutation type/i);
    });
});
