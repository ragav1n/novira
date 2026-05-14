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
            <SheetContent side="bottom" className="border-white/5 bg-background rounded-t-2xl">
                <SheetHeader>
                    <SheetTitle>Recategorize {selectedCount}</SheetTitle>
                    <SheetDescription>Pick a new category for the selected transactions.</SheetDescription>
                </SheetHeader>
                <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto py-4">
                    {SYSTEM_CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => onRecategorize(cat.id)}
                            className="flex items-center gap-3 p-3 rounded-xl border bg-secondary/10 border-white/5 hover:border-white/20 transition-colors text-left"
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
                            <span className="text-sm font-medium">{cat.label}</span>
                        </button>
                    ))}
                </div>
            </SheetContent>
        </Sheet>
    );
}
