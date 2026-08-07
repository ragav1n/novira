'use client';

import { useCallback, useState } from 'react';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

export interface ConfirmRequest {
    title: string;
    /** State the consequence plainly, including whether it can be undone. */
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    /** Styles the action button as destructive. Defaults to true. */
    destructive?: boolean;
    onConfirm: () => void | Promise<void>;
}

/**
 * A promise-free confirm for destructive actions.
 *
 * Replaces the Sonner action-toast pattern that was previously used for confirms:
 * those inherit the global 3s toast duration, so the confirmation vanished before it
 * could be read, and on mobile they render over the floating bottom nav.
 *
 * Usage:
 *   const { confirm, dialog } = useConfirm();
 *   ...
 *   <button onClick={() => confirm({ title: 'Delete X?', description: '…', onConfirm: doIt })} />
 *   {dialog}
 */
export function useConfirm() {
    const [request, setRequest] = useState<ConfirmRequest | null>(null);
    const [busy, setBusy] = useState(false);

    const confirm = useCallback((req: ConfirmRequest) => setRequest(req), []);

    const handleConfirm = useCallback(async () => {
        if (!request || busy) return;
        setBusy(true);
        try {
            await request.onConfirm();
            setRequest(null);
        } finally {
            setBusy(false);
        }
    }, [request, busy]);

    const dialog = (
        <AlertDialog
            open={!!request}
            // Not dismissible mid-flight, so the action can't be abandoned halfway.
            onOpenChange={(open) => { if (!open && !busy) setRequest(null); }}
        >
            {/* No local z-index override needed any more: ui/alert-dialog.tsx now sits
                at z-[190]/z-[200] by default, above Dialog's z-[100]/z-[110]. This used
                to carry a `z-[200]` patch because the primitive was still at shadcn's
                stock z-50, which made a confirm opened from inside a Dialog (group
                settings, trip form, goal history) render underneath its parent's
                overlay — visible and completely unclickable. */}
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{request?.title}</AlertDialogTitle>
                    <AlertDialogDescription>{request?.description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={busy} className="min-h-[44px]">
                        {request?.cancelLabel ?? 'Cancel'}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        disabled={busy}
                        aria-busy={busy}
                        className={cn(
                            'min-h-[44px]',
                            (request?.destructive ?? true) &&
                                'bg-destructive text-destructive-foreground hover:bg-destructive/90',
                        )}
                        onClick={(e) => { e.preventDefault(); handleConfirm(); }}
                    >
                        {busy ? 'Working…' : (request?.confirmLabel ?? 'Confirm')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );

    return { confirm, dialog, busy };
}
