'use client';

import { useCallback, useRef, useState } from 'react';
import { queueReceiptUpload } from '@/lib/sync-manager';
import { validateReceiptFile } from '@/lib/receipt-storage';
import { downscaleImage } from '@/lib/image-downscale';
import { toast } from '@/utils/haptics';
import type { Transaction } from '@/types/transaction';

/**
 * Attach or replace a receipt on a transaction that already exists.
 *
 * Until now a receipt could only be added while creating a transaction, so a
 * failed upload — or simply forgetting — was unrecoverable. One hidden input is
 * shared by the whole list rather than rendered per row.
 *
 * Render `input` somewhere in the consuming view and pass `attach` to the rows.
 */
export function useReceiptAttach(userId: string | null | undefined) {
    const inputRef = useRef<HTMLInputElement>(null);
    const targetRef = useRef<Transaction | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    const attach = useCallback((tx: Transaction) => {
        targetRef.current = tx;
        // Reset first so re-picking the same file still fires onChange.
        if (inputRef.current) {
            inputRef.current.value = '';
            inputRef.current.click();
        }
    }, []);

    const onFilePicked = useCallback(async (file: File) => {
        const tx = targetRef.current;
        targetRef.current = null;
        if (!tx) return;
        if (!userId) {
            toast.error('You must be logged in to attach a receipt');
            return;
        }
        // Storage RLS requires the path's first folder to be auth.uid(), so a
        // receipt can only ever be written into the uploader's own folder. A group
        // list shows other members' rows, and uploading against one of those would
        // be rejected — then retried five times before surfacing. The row's
        // `canEdit` already implies ownership; this is the belt to that braces.
        if (tx.user_id && tx.user_id !== userId) {
            console.warn('[useReceiptAttach] refusing to attach to another user\'s transaction', tx.id);
            toast.error('You can only attach receipts to your own expenses');
            return;
        }
        const ownerId = userId;

        setBusyId(tx.id);
        try {
            const prepared = await downscaleImage(file);
            const check = validateReceiptFile(prepared);
            if (!check.valid) {
                toast.error(check.reason);
                return;
            }
            await queueReceiptUpload(tx.id, ownerId, prepared, tx.receipt_path ?? null);
            toast.success(
                tx.receipt_path
                    ? 'Receipt replaced — uploading'
                    : 'Receipt attached — uploading'
            );
        } catch (err) {
            console.error('[useReceiptAttach] could not queue receipt', err);
            toast.error("Couldn't attach that receipt — please try again");
        } finally {
            setBusyId(null);
        }
    }, [userId]);

    return { attach, busyId, inputRef, onFilePicked };
}
