'use client';

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { FileWarning, Loader2, Maximize2 } from 'lucide-react';
import { getReceiptSignedUrl } from '@/lib/receipt-storage';

interface ReceiptViewerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    receiptPath: string | null;
}

export function ReceiptViewerDialog({ open, onOpenChange, receiptPath }: ReceiptViewerDialogProps) {
    const [url, setUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open || !receiptPath) {
            setUrl(null);
            setError(null);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setError(null);
        getReceiptSignedUrl(receiptPath)
            .then(signed => {
                if (cancelled) return;
                setUrl(signed);
            })
            .catch(err => {
                if (cancelled) return;
                console.error('[ReceiptViewer] signed-url failed', err);
                setError('Could not load receipt. It may have been deleted.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [open, receiptPath]);

    const isPdf = !!receiptPath && receiptPath.toLowerCase().endsWith('.pdf');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl p-0 bg-card/95 backdrop-blur-xl border-white/10 overflow-hidden gap-0">
                <div className="flex items-center px-4 py-3 border-b border-white/10 pr-12">
                    <DialogTitle className="text-sm font-semibold">Receipt</DialogTitle>
                </div>
                <div className="relative bg-black/40 min-h-[420px] flex items-center justify-center">
                    {loading && <Loader2 className="w-8 h-8 animate-spin text-primary/60" />}
                    {error && !loading && (
                        <div className="flex flex-col items-center gap-2 text-center px-6 text-white/70">
                            <FileWarning className="w-8 h-8 text-amber-400/70" />
                            <p className="text-sm">{error}</p>
                        </div>
                    )}
                    {url && !loading && !error && (
                        isPdf ? (
                            <iframe
                                src={url}
                                title="Receipt PDF"
                                className="w-full h-[70vh] bg-white"
                            />
                        ) : (
                            <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="relative group block max-h-[75vh]"
                                aria-label="Open receipt full-screen for zoom"
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={url}
                                    alt="Receipt"
                                    className="max-w-full max-h-[75vh] object-contain"
                                />
                                <span className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/70 backdrop-blur-sm text-white text-[11px] font-semibold opacity-90 group-hover:opacity-100 transition-opacity">
                                    <Maximize2 className="w-3 h-3" />
                                    Tap to zoom
                                </span>
                            </a>
                        )
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
