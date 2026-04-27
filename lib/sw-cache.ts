const SUPABASE_TX_PATHS = [
    '/rest/v1/transactions',
    '/rest/v1/splits',
    '/rest/v1/recurring_templates',
];

export const TRANSACTIONS_INVALIDATED_CHANNEL = 'novira-transactions-invalidated';

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
        getChannel()?.postMessage({ type: 'invalidated', at: Date.now() });
    } catch {
        // BroadcastChannel can throw if closed; non-fatal
    }
}
