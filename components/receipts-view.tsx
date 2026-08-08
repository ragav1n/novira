'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Paperclip, FileWarning, FileText, ImageOff } from 'lucide-react';
import { parseISO } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useRefreshRequest } from '@/hooks/useRefreshRequest';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { getReceiptSignedUrls } from '@/lib/receipt-storage';
import { ReceiptViewerDialog } from '@/components/receipt-viewer-dialog';
import { useReceiptViewer } from '@/hooks/useReceiptViewer';
import { useFormattedDate } from '@/utils/format-date';
import { toast } from '@/utils/haptics';
import { cn } from '@/lib/utils';
import { ViewHeader } from '@/components/ui/view-header';
import { EmptyState } from '@/components/ui/empty-state';

/** Server-side cap on the grid. Surfaced in the header only when it actually bites. */
const RECEIPT_LIMIT = 300;

interface ReceiptRow {
    id: string;
    description: string;
    amount: number;
    currency: string;
    date: string;
    receipt_path: string;
}

export function ReceiptsView() {
    const goBack = useSafeBack('/');
    const { userId, formatCurrency, activeWorkspaceId } = useUserPreferences();
    const [rows, setRows] = useState<ReceiptRow[]>([]);
    const [urlMap, setUrlMap] = useState<Map<string, string>>(() => new Map());
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [urlError, setUrlError] = useState(false);
    const receiptViewer = useReceiptViewer();
    // Bumped per load so a stale in-flight fetch can't land on top of a newer one.
    const fetchGenRef = useRef(0);

    const load = useCallback(async () => {
        if (!userId) {
            setLoading(false);
            return;
        }
        const myGen = ++fetchGenRef.current;
        setLoading(true);
        let query = supabase
            .from('transactions')
            .select('id, description, amount, currency, date, receipt_path')
            .eq('user_id', userId)
            .not('receipt_path', 'is', null)
            .order('date', { ascending: false })
            .limit(RECEIPT_LIMIT);
        if (activeWorkspaceId) query = query.eq('group_id', activeWorkspaceId);
        const { data, error } = await query;
        if (fetchGenRef.current !== myGen) return;
        if (error) {
            // Falling through to an empty list here would render "No receipts yet",
            // which is indistinguishable from the receipts having been deleted.
            console.error('Failed to load receipts:', {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint,
            });
            setLoadError(true);
            setLoading(false);
            toast.error("Couldn't load your receipts");
            return;
        }
        const list = (data || []) as ReceiptRow[];
        setLoadError(false);
        setRows(list);
        // Batch-sign all non-PDF receipt paths in one round-trip. PDFs render
        // as a static FileText placeholder so signing them upfront is wasted.
        const imagePaths = list
            .filter(r => !r.receipt_path.toLowerCase().endsWith('.pdf'))
            .map(r => r.receipt_path);
        if (imagePaths.length === 0) {
            setUrlMap(new Map());
            setUrlError(false);
        } else {
            try {
                const map = await getReceiptSignedUrls(imagePaths);
                if (fetchGenRef.current !== myGen) return;
                setUrlMap(map);
                setUrlError(false);
            } catch (err) {
                console.error('Failed to batch-sign receipt URLs:', err);
                if (fetchGenRef.current !== myGen) return;
                setUrlMap(new Map());
                // The rows themselves loaded; only the previews are missing. Say so,
                // rather than leaving every tile as an unexplained warning icon.
                setUrlError(true);
                toast.error("Couldn't load receipt previews");
            }
        }
        if (fetchGenRef.current === myGen) setLoading(false);
    }, [userId, activeWorkspaceId]);

    useEffect(() => { load(); }, [load]);

    useRefreshRequest(() => load());

    return (
        <div className="relative min-h-[100dvh] w-full">
            <div className="p-5 space-y-6 max-w-md lg:max-w-4xl mx-auto relative lg:pb-8">
                <ViewHeader
                    onBack={goBack}
                    title={
                        <span className="inline-flex items-center gap-2">
                            <Paperclip className="w-4 h-4 text-primary" aria-hidden="true" />
                            Receipts
                        </span>
                    }
                />

                {!loading && !loadError && rows.length > 0 && (
                    <p className="text-meta text-muted-foreground/70 text-center">
                        {/* Only claim a cap when we actually hit it — the old copy said
                            "Showing 300 receipts" regardless of the real count. */}
                        {rows.length === RECEIPT_LIMIT
                            ? `Showing your ${RECEIPT_LIMIT} most recent receipts`
                            : `${rows.length} receipt${rows.length === 1 ? '' : 's'} · most recent first`}
                    </p>
                )}

                {urlError && !loading && !loadError && (
                    <p className="text-meta text-amber-400/80 text-center">
                        Previews couldn&apos;t load. Tap any receipt to try opening it.
                    </p>
                )}

                {loading ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="aspect-square rounded-xl bg-secondary/10 animate-pulse" />
                        ))}
                    </div>
                ) : loadError ? (
                    <EmptyState
                        size="page"
                        variant="error"
                        iconVariant="tile"
                        title="Couldn't load your receipts"
                        description="Your receipts are safe — we just couldn't reach them."
                        action={{ label: 'Try again', onClick: () => load() }}
                    />
                ) : rows.length === 0 ? (
                    <EmptyState
                        size="page"
                        iconVariant="tile"
                        icon={ImageOff}
                        title="No receipts yet"
                        description="Scan or attach a receipt when adding an expense and it'll appear here."
                        action={{ label: 'Add an expense', href: '/add' }}
                    />
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
        </div>
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
            className="text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-xl"
            aria-label={`Open receipt for ${row.description}`}
        >
            <div className={cn(
                "aspect-square rounded-xl border border-white/5 bg-secondary/15 overflow-hidden relative flex items-center justify-center",
                "group-hover:border-white/15 transition-colors"
            )}>
                {isPdf ? (
                    <div className="flex flex-col items-center gap-1.5 text-muted-foreground/70">
                        <FileText className="w-7 h-7" aria-hidden="true" />
                        <span className="text-micro uppercase tracking-widest font-bold">PDF</span>
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
                <p className="text-meta font-semibold truncate">{row.description}</p>
                <p className="text-caption text-muted-foreground/80 tabular-nums truncate">
                    {formatCurrency(Number(row.amount), row.currency)} · {formatDate(parseISO(row.date.slice(0, 10)), 'short')}
                </p>
            </div>
        </button>
    );
}
