import { useState, useEffect } from 'react';
import { get } from 'idb-keyval';
import { SyncPayload } from '@/lib/offline-sync-queue';

export function useSyncQueueState() {
    const [queue, setQueue] = useState<SyncPayload[]>([]);
    const [isSyncingEvent, setIsSyncingEvent] = useState(false);

    useEffect(() => {
        let mounted = true;
        
        get<SyncPayload[]>('novira-offline-queue').then(q => {
            if (mounted) setQueue(q || []);
        });

        const handler = (e: any) => {
            if (mounted) setQueue(e.detail.queue || []);
        };
        
        const onSyncStart = () => { if (mounted) setIsSyncingEvent(true); };
        const onSyncEnd = () => { if (mounted) setIsSyncingEvent(false); };
        
        window.addEventListener('novira-queue-updated', handler);
        window.addEventListener('novira-sync-started', onSyncStart);
        window.addEventListener('novira-sync-finished', onSyncEnd);

        return () => {
            mounted = false;
            window.removeEventListener('novira-queue-updated', handler);
            window.removeEventListener('novira-sync-started', onSyncStart);
            window.removeEventListener('novira-sync-finished', onSyncEnd);
        };
    }, []);

    const pendingCount = queue.filter(q => q.status === 'pending').length;
    const syncingCount = queue.filter(q => q.status === 'syncing').length;
    const failedItems = queue.filter(q => q.status === 'failed');

    return { 
        queue, 
        pending: pendingCount, 
        syncing: syncingCount > 0 || isSyncingEvent, 
        failed: failedItems.length,
        failedItems 
    };
}
