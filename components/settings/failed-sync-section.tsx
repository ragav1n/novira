'use client';

import { AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { retryFailedItem, discardFailedItem } from '@/lib/sync-manager';

type FailedItem = {
    id: string;
    errorReason?: string;
    failedAt?: string | number | Date;
    data: { transaction?: { description?: string } };
};

interface Props {
    failedItems: FailedItem[];
}

export function FailedSyncSection({ failedItems }: Props) {
    if (failedItems.length === 0) return null;

    return (
        <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-3xl space-y-3 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-semibold text-sm">Offline Sync Failures</h3>
            </div>
            <p className="text-xs text-muted-foreground">
                {failedItems.length} transaction{failedItems.length > 1 ? 's' : ''} failed to sync permanently due to server conflicts.
            </p>
            <div className="space-y-2">
                {failedItems.map(item => (
                    <div key={item.id} className="bg-background/80 p-3 rounded-2xl flex flex-col gap-2 shadow-sm border border-destructive/20 backdrop-blur-md">
                        <div className="flex items-start justify-between">
                            <div className="min-w-0">
                                <p className="text-sm font-bold truncate">{item.data.transaction?.description || 'Unknown Item'}</p>
                                <p className="text-[10px] font-bold text-destructive/80 mt-0.5 uppercase tracking-tighter">Error: {item.errorReason || 'Server Conflict'}</p>
                            </div>
                            {item.failedAt && <span className="text-[9px] text-muted-foreground whitespace-nowrap">{format(new Date(item.failedAt), 'HH:mm')}</span>}
                        </div>
                        <div className="flex gap-2 justify-end mt-1">
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => discardFailedItem(item.id)}
                                className="h-8 px-4 text-[11px] font-bold hover:bg-destructive/10 hover:text-destructive text-muted-foreground border border-transparent hover:border-destructive/20 rounded-xl transition-all"
                            >
                                Discard
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => retryFailedItem(item.id)}
                                className="h-8 px-4 text-[11px] font-bold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/20"
                            >
                                Retry Sync
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
