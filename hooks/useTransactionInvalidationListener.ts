import { useEffect, useRef } from 'react';
import { TRANSACTIONS_INVALIDATED_CHANNEL, getInvalidationSenderId } from '@/lib/sw-cache';

export function useTransactionInvalidationListener(refetch: () => void) {
    const refetchRef = useRef(refetch);
    refetchRef.current = refetch;

    useEffect(() => {
        if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
        const channel = new BroadcastChannel(TRANSACTIONS_INVALIDATED_CHANNEL);
        const ownId = getInvalidationSenderId();
        channel.onmessage = (e: MessageEvent) => {
            // Skip our own tab — the local mutation has already updated state
            // optimistically. Refetching here races Postgres replication and
            // can briefly resurrect a row the user just deleted.
            const senderId = (e.data as { senderId?: string } | undefined)?.senderId;
            if (senderId && senderId === ownId) return;
            refetchRef.current();
        };
        return () => channel.close();
    }, []);
}
