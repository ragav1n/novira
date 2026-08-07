'use client';

import React from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CATEGORY_COLORS, getIconForCategory, CATEGORIES as SYSTEM_CATEGORIES } from '@/lib/categories';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedCount: number;
    onRecategorize: (categoryId: string) => void;
    /** True while a batch is in flight. Without it, tapping a second category hit the
     *  caller's busy guard and returned with no toast, no spinner and the sheet open. */
    busy?: boolean;
}

export function RecategorizeSheet({ open, onOpenChange, selectedCount, onRecategorize, busy = false }: Props) {
    const [pendingCategory, setPendingCategory] = React.useState<string | null>(null);

    // Clear the local pending marker whenever the batch finishes.
    React.useEffect(() => { if (!busy) setPendingCategory(null); }, [busy]);

    return (
        <Sheet open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
            <SheetContent side="bottom" className="border-white/[0.06] bg-background rounded-t-2xl">
                <SheetHeader className="space-y-1">
                    <SheetTitle className="text-[15px] font-semibold tracking-tight">
                        Recategorize <span className="text-muted-foreground/70 font-medium tabular-nums">{selectedCount}</span>
                    </SheetTitle>
                    <SheetDescription className="text-[12px] text-muted-foreground/70">Pick a new category for the selected transactions.</SheetDescription>
                </SheetHeader>
                <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto py-4">
                    {SYSTEM_CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            type="button"
                            disabled={busy}
                            aria-busy={busy && pendingCategory === cat.id}
                            onClick={() => { setPendingCategory(cat.id); onRecategorize(cat.id); }}
                            className="flex items-center gap-3 p-3 rounded-xl border bg-secondary/10 border-white/[0.06] hover:border-white/15 transition-colors text-left disabled:opacity-50 disabled:pointer-events-none"
                        >
                            <div
                                className="w-8 h-8 rounded-full flex items-center justify-center border"
                                style={{
                                    backgroundColor: `${CATEGORY_COLORS[cat.id] || '#8A2BE2'}20`,
                                    borderColor: `${CATEGORY_COLORS[cat.id] || '#8A2BE2'}40`,
                                }}
                            >
                                {React.cloneElement(getIconForCategory(cat.id) as React.ReactElement<{ style?: React.CSSProperties }>, {
                                    style: { color: CATEGORY_COLORS[cat.id] || '#8A2BE2' },
                                })}
                            </div>
                            <span className="text-[13px] font-medium">{cat.label}</span>
                            {busy && pendingCategory === cat.id && (
                                <span className="ml-auto text-[11px] text-muted-foreground">Applying…</span>
                            )}
                        </button>
                    ))}
                </div>
            </SheetContent>
        </Sheet>
    );
}
