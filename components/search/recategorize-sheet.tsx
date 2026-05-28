'use client';

import React from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CATEGORY_COLORS, getIconForCategory, CATEGORIES as SYSTEM_CATEGORIES } from '@/lib/categories';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedCount: number;
    onRecategorize: (categoryId: string) => void;
}

export function RecategorizeSheet({ open, onOpenChange, selectedCount, onRecategorize }: Props) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
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
                            onClick={() => onRecategorize(cat.id)}
                            className="flex items-center gap-3 p-3 rounded-xl border bg-secondary/10 border-white/[0.06] hover:border-white/15 transition-colors text-left"
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
                        </button>
                    ))}
                </div>
            </SheetContent>
        </Sheet>
    );
}
