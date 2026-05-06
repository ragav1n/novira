'use client';

import { AlertTriangle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { retryFailedItem, discardFailedItem } from '@/lib/sync-manager';
import type { SyncPayload, SyncErrorKind } from '@/lib/offline-sync-queue';

const KIND_BADGE: Record<SyncErrorKind, { label: string; className: string }> = {
    permanent: { label: 'Permanent', className: 'bg-destructive/15 text-destructive' },
    transient: { label: 'Network', className: 'bg-amber-500/15 text-amber-400' },
    expired: { label: 'Expired', className: 'bg-muted text-muted-foreground' },
};

interface Props {
    failedItems: SyncPayload[];
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
                {failedItems.length} item{failedItems.length > 1 ? 's' : ''} couldn&apos;t sync. Review below — retry transient errors, discard permanent or expired ones.
            </p>
            <div className="space-y-2">
                {failedItems.map(item => {
                    const kind = (item.errorKind ?? 'permanent') as SyncErrorKind;
                    const badge = KIND_BADGE[kind];
                    const isExpired = kind === 'expired';
                    const description = item.data?.transaction?.description ?? item.data?.description ?? 'Unknown Item';
                    return (
                        <div key={item.id} className="bg-background/80 p-3 rounded-2xl flex flex-col gap-2 shadow-sm border border-destructive/20 backdrop-blur-md">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <p className="text-sm font-bold truncate">{description}</p>
                                        <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full ${badge.className} inline-flex items-center gap-0.5`}>
                                            {isExpired && <Clock className="w-2.5 h-2.5" />}
                                            {badge.label}
                                        </span>
                                    </div>
                                    <p className="text-[10px] font-bold text-destructive/80 mt-0.5 uppercase tracking-tighter break-words">
                                        {item.errorReason || 'Server Conflict'}
                                    </p>
                                </div>
                                {item.failedAt && <span className="text-[9px] text-muted-foreground whitespace-nowrap">{format(new Date(item.failedAt), 'HH:mm')}</span>}
                            </div>
                            <div className="flex gap-2 justify-end mt-1">
                                <Button
                                    size="sm"
                                    variant={isExpired || kind === 'permanent' ? undefined : 'ghost'}
                                    onClick={() => discardFailedItem(item.id)}
                                    className={
                                        isExpired || kind === 'permanent'
                                            ? 'h-8 px-4 text-[11px] font-bold bg-destructive hover:bg-destructive/90 text-white rounded-xl shadow-lg shadow-destructive/20'
                                            : 'h-8 px-4 text-[11px] font-bold hover:bg-destructive/10 hover:text-destructive text-muted-foreground border border-transparent hover:border-destructive/20 rounded-xl transition-all'
                                    }
                                >
                                    Discard
                                </Button>
                                {!isExpired && (
                                    <Button
                                        size="sm"
                                        variant={kind === 'permanent' ? 'ghost' : undefined}
                                        onClick={() => retryFailedItem(item.id)}
                                        className={
                                            kind === 'permanent'
                                                ? 'h-8 px-4 text-[11px] font-bold hover:bg-primary/10 hover:text-primary text-muted-foreground border border-transparent hover:border-primary/20 rounded-xl transition-all'
                                                : 'h-8 px-4 text-[11px] font-bold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/20'
                                        }
                                    >
                                        Retry Sync
                                    </Button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
