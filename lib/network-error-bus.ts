/**
 * Lightweight in-process bus for surfacing background Supabase fetch failures
 * to a top-level banner. Per-action errors should still use toast(); this is
 * for the silent catches in providers/hooks (initial loads, background fetches)
 * where the user otherwise sees nothing.
 */

const EVENT = 'novira-network-error';

export type NetworkErrorDetail = {
    message: string;
    source: string;
    retry?: () => void;
};

export function reportNetworkError(detail: NetworkErrorDetail) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent<NetworkErrorDetail>(EVENT, { detail }));
}

export function subscribeNetworkError(handler: (detail: NetworkErrorDetail) => void) {
    if (typeof window === 'undefined') return () => undefined;
    const listener = (e: Event) => handler((e as CustomEvent<NetworkErrorDetail>).detail);
    window.addEventListener(EVENT, listener);
    return () => window.removeEventListener(EVENT, listener);
}
