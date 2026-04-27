import { useEffect, useRef } from 'react';
import { TRANSACTIONS_INVALIDATED_CHANNEL } from '@/lib/sw-cache';

export function useTransactionInvalidationListener(refetch: () => void) {
    const refetchRef = useRef(refetch);
    refetchRef.current = refetch;

    useEffect(() => {
        if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
        const channel = new BroadcastChannel(TRANSACTIONS_INVALIDATED_CHANNEL);
        channel.onmessage = () => refetchRef.current();
        return () => channel.close();
    }, []);
}
