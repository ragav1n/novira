'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronLeft, Paperclip, FileWarning, FileText, ImageOff } from 'lucide-react';
import { parseISO } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { getReceiptSignedUrls } from '@/lib/receipt-storage';
import { ReceiptViewerDialog } from '@/components/receipt-viewer-dialog';
import { useReceiptViewer } from '@/hooks/useReceiptViewer';
import { useFormattedDate } from '@/utils/format-date';
import { cn } from '@/lib/utils';

interface ReceiptRow {
    id: string;
    description: string;
    amount: number;
    currency: string;
    date: string;
    receipt_path: string;
}

export function ReceiptsView() {
    const router = useRouter();
    const { userId, formatCurrency, activeWorkspaceId } = useUserPreferences();
    const [rows, setRows] = useState<ReceiptRow[]>([]);
    const [urlMap, setUrlMap] = useState<Map<string, string>>(() => new Map());
    const [loading, setLoading] = useState(true);
    const receiptViewer = useReceiptViewer();

    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            let query = supabase
                .from('transactions')
                .select('id, description, amount, currency, date, receipt_path')
                .eq('user_id', userId)
                .not('receipt_path', 'is', null)
                .order('date', { ascending: false })
                .limit(300);
            if (activeWorkspaceId) query = query.eq('group_id', activeWorkspaceId);
            const { data, error } = await query;
            if (cancelled) return;
            if (error) {
                console.error('Failed to load receipts:', error);
                setRows([]);
                setUrlMap(new Map());
                setLoading(false);
                return;
            }
            const list = (data || []) as ReceiptRow[];
            setRows(list);
            // Batch-sign all non-PDF receipt paths in one round-trip. PDFs render
            // as a static FileText placeholder so signing them upfront is wasted.
            const imagePaths = list
                .filter(r => !r.receipt_path.toLowerCase().endsWith('.pdf'))
                .map(r => r.receipt_path);
            if (imagePaths.length === 0) {
                setUrlMap(new Map());
            } else {
                try {
                    const map = await getReceiptSignedUrls(imagePaths);
                    if (!cancelled) setUrlMap(map);
                } catch (err) {
                    console.error('Failed to batch-sign receipt URLs:', err);
                    if (!cancelled) setUrlMap(new Map());
                }
            }
            if (!cancelled) setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [userId, activeWorkspaceId]);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 220, damping: 28, mass: 0.9 }}
            className="relative min-h-[100dvh] w-full"
        >
            <div className="p-5 space-y-6 max-w-md lg:max-w-4xl mx-auto relative pb-24 lg:pb-8">
                <div className="flex items-center justify-between relative min-h-[40px]">
                    <button
                        onClick={() => router.back()}
                        className="p-2 rounded-full bg-secondary/30 hover:bg-secondary/50 transition-colors shrink-0 z-10"
                        aria-label="Go back"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Paperclip className="w-4 h-4 text-primary" aria-hidden="true" />
                            Receipts
                        </h2>
                    </div>
                    <div className="w-9 shrink-0 z-10" />
                </div>

                {!loading && rows.length > 0 && (
                    <p className="text-[11px] text-muted-foreground/70 text-center">
                        Showing {rows.length} receipt{rows.length === 1 ? '' : 's'} · most recent first
                    </p>
                )}

                {loading ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="aspect-square rounded-2xl bg-secondary/10 animate-pulse" />
                        ))}
                    </div>
                ) : rows.length === 0 ? (
                    <div className="text-center py-20 space-y-3 opacity-70">
                        <div className="w-12 h-12 rounded-2xl bg-secondary/30 flex items-center justify-center mx-auto">
                            <ImageOff className="w-5 h-5 text-muted-foreground/70" />
                        </div>
                        <p className="text-sm font-bold">No receipts yet</p>
                        <p className="text-[12px] text-muted-foreground max-w-[260px] mx-auto">
                            Scan or attach a receipt when adding an expense and it'll appear here.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {rows.map(r => (
                            <ReceiptCell
                                key={r.id}
                                row={r}
                                url={urlMap.get(r.receipt_path) ?? null}
                                formatCurrency={formatCurrency}
                                onOpen={() => receiptViewer.view(r.receipt_path)}
                            />
                        ))}
                    </div>
                )}
            </div>

            <ReceiptViewerDialog
                open={receiptViewer.open}
                onOpenChange={receiptViewer.setOpen}
                receiptPath={receiptViewer.path}
            />
        </motion.div>
    );
}

function ReceiptCell({
    row,
    url,
    formatCurrency,
    onOpen,
}: {
    row: ReceiptRow;
    url: string | null;
    formatCurrency: (amount: number, currency?: string) => string;
    onOpen: () => void;
}) {
    const formatDate = useFormattedDate();
    const isPdf = row.receipt_path.toLowerCase().endsWith('.pdf');

    return (
        <button
            onClick={onOpen}
            className="text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-2xl"
            aria-label={`Open receipt for ${row.description}`}
        >
            <div className={cn(
                "aspect-square rounded-2xl border border-white/5 bg-secondary/15 overflow-hidden relative flex items-center justify-center",
                "group-hover:border-white/15 transition-colors"
            )}>
                {isPdf ? (
                    <div className="flex flex-col items-center gap-1.5 text-muted-foreground/70">
                        <FileText className="w-7 h-7" aria-hidden="true" />
                        <span className="text-[9px] uppercase tracking-widest font-bold">PDF</span>
                    </div>
                ) : url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                        src={url}
                        alt={row.description}
                        loading="lazy"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <FileWarning className="w-6 h-6 text-amber-400/70" aria-hidden="true" />
                )}
            </div>
            <div className="mt-1.5 px-0.5 space-y-0.5">
                <p className="text-[11.5px] font-semibold truncate">{row.description}</p>
                <p className="text-[10.5px] text-muted-foreground/80 tabular-nums truncate">
                    {formatCurrency(Number(row.amount), row.currency)} · {formatDate(parseISO(row.date.slice(0, 10)), 'short')}
                </p>
            </div>
        </button>
    );
}
