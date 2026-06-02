import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, Trophy } from 'lucide-react';
import { CATEGORY_COLORS, getCategoryLabel } from '@/lib/categories';
import type { TopPlace } from '@/hooks/useMapData';

interface MapSummaryPanelProps {
    open: boolean;
    onClose: () => void;
    topPlaces: TopPlace[];
    totalLabel: string;
    formatCurrency: (amount: number, currency?: string) => string;
    onSelectPlace: (place: TopPlace) => void;
}

const MAX_ROWS = 8;

export function MapSummaryPanel({ open, onClose, topPlaces, totalLabel, formatCurrency, onSelectPlace }: MapSummaryPanelProps) {
    const rows = topPlaces.slice(0, MAX_ROWS);
    const maxTotal = rows[0]?.total || 1;
    const reduceMotion = useReducedMotion();

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ y: 320, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 320, opacity: 0 }}
                    transition={reduceMotion ? { duration: 0 } : { type: 'spring', damping: 28, stiffness: 320 }}
                    className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-[360px] z-40 max-h-[55vh] overflow-hidden flex flex-col rounded-2xl bg-card/95 backdrop-blur-xl border border-white/10 shadow-2xl"
                >
                    <div className="p-4 border-b border-white/10 flex items-center justify-between bg-card/80 sticky top-0">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-amber-500/40 bg-amber-500/20">
                                <Trophy className="w-4 h-4 text-amber-400" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-black truncate">Top places</p>
                                <p className="text-[10px] text-muted-foreground">{totalLabel} total</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-full hover:bg-white/10 text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            aria-label="Close top places"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="overflow-y-auto p-2 no-scrollbar">
                        {rows.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-6">No places in this range.</p>
                        )}
                        {rows.map((place, i) => {
                            const color = CATEGORY_COLORS[place.topCategory as keyof typeof CATEGORY_COLORS] || CATEGORY_COLORS.others;
                            const pct = Math.max(6, (place.total / maxTotal) * 100);
                            return (
                                <button
                                    key={`${place.lat},${place.lng}`}
                                    onClick={() => onSelectPlace(place)}
                                    className="w-full text-left p-2.5 mb-1 rounded-xl hover:bg-white/5 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="w-5 text-center text-xs font-black text-muted-foreground shrink-0">{i + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-sm font-bold truncate">{place.placeName}</p>
                                                <span className="text-sm font-black shrink-0">{formatCurrency(place.total)}</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className="h-1.5 flex-1 rounded-full bg-white/5 overflow-hidden">
                                                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                                                </div>
                                                <span className="text-[10px] text-muted-foreground shrink-0 capitalize">
                                                    {getCategoryLabel(place.topCategory)} · {place.count}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
