const SUPABASE_TX_PATHS = [
    '/rest/v1/transactions',
    '/rest/v1/splits',
    '/rest/v1/recurring_templates',
];

export const TRANSACTIONS_INVALIDATED_CHANNEL = 'novira-transactions-invalidated';

// Per-tab sender id. BroadcastChannel excludes only the exact source instance
// from receiving its own messages — but the sender and the listener live in
// different instances here, so without an id the originating tab would receive
// its own broadcast and race-refetch a row it just deleted (before Postgres
// replication settles), causing the row to briefly reappear.
const SENDER_ID: string = (() => {
    try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
    } catch { /* fallthrough */ }
    return `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
})();

export function getInvalidationSenderId(): string {
    return SENDER_ID;
}

let cachedChannel: BroadcastChannel | null | undefined;
function getChannel(): BroadcastChannel | null {
    if (cachedChannel !== undefined) return cachedChannel;
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
        cachedChannel = null;
        return null;
    }
    cachedChannel = new BroadcastChannel(TRANSACTIONS_INVALIDATED_CHANNEL);
    return cachedChannel;
}

export function invalidateTransactionCaches() {
    if (typeof navigator === 'undefined') return;
    const controller = navigator.serviceWorker?.controller;
    if (controller) {
        for (const pattern of SUPABASE_TX_PATHS) {
            controller.postMessage({ type: 'INVALIDATE_SUPABASE_CACHE', pattern });
        }
    }
    // SW caches are origin-shared, so the cache is now clean for every tab. But each
    // tab holds its own React state — wake other tabs so they refetch instead of
    // sitting on stale rows until their next mount or visibility flip.
    try {
        getChannel()?.postMessage({ type: 'invalidated', at: Date.now(), senderId: SENDER_ID });
    } catch {
        // BroadcastChannel can throw if closed; non-fatal
    }
}
