'use client';

import { useCallback, useState } from 'react';

/**
 * Tiny state holder for the receipt viewer dialog. One per consumer view
 * (dashboard, search, etc.) so multiple lists don't accidentally share state.
 */
export function useReceiptViewer() {
    const [open, setOpen] = useState(false);
    const [path, setPath] = useState<string | null>(null);

    const view = useCallback((p: string | null | undefined) => {
        if (!p) return;
        setPath(p);
        setOpen(true);
    }, []);

    return { open, setOpen, path, view };
}
