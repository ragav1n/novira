'use client';

import type { RefObject } from 'react';
import { RECEIPT_ACCEPT } from '@/lib/receipt-storage';

interface Props {
    inputRef: RefObject<HTMLInputElement | null>;
    onFilePicked: (file: File) => void | Promise<void>;
}

/**
 * One hidden input shared by a whole transaction list, driven by useReceiptAttach.
 * Rendering it per row would mount hundreds of inputs for no reason.
 */
export function ReceiptAttachInput({ inputRef, onFilePicked }: Props) {
    return (
        <input
            ref={inputRef}
            type="file"
            accept={RECEIPT_ACCEPT}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
            onChange={async (e) => {
                const file = e.target.files?.[0];
                // Captured before the await: currentTarget is only valid during dispatch.
                const target = e.currentTarget;
                if (!file) return;
                try {
                    await onFilePicked(file);
                } finally {
                    target.value = '';
                }
            }}
        />
    );
}
