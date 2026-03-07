import React, { ReactNode } from 'react';
import { MapPin, X } from 'lucide-react';

interface MapHeaderProps {
    transactionCount: number;
    onClose: () => void;
    children?: ReactNode;
}

export function MapHeader({ transactionCount, onClose, children }: MapHeaderProps) {
    return (
        <div className="absolute top-0 left-0 right-0 z-20 flex flex-col sm:flex-row items-center justify-between p-4 sm:p-6 bg-gradient-to-b from-background/90 via-background/40 to-transparent pointer-events-none">
            <div className="w-full sm:w-auto flex items-center justify-between gap-3 pointer-events-auto">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 backdrop-blur-md shrink-0">
                        <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-lg font-black tracking-tight truncate">Expense Map</h2>
                        <p className="text-[11px] text-muted-foreground font-medium">
                            {transactionCount} location{transactionCount !== 1 ? 's' : ''} tagged
                        </p>
                    </div>
                </div>
                
                {/* Mobile-only Close */}
                <button
                    onClick={onClose}
                    className="sm:hidden w-10 h-10 rounded-full bg-card/60 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-white/10 transition-colors pointer-events-auto shrink-0"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {children}

            {/* Desktop-only Close */}
            <button
                onClick={onClose}
                className="hidden sm:flex w-10 h-10 rounded-full bg-card/60 backdrop-blur-md items-center justify-center border border-white/10 hover:bg-white/10 transition-colors pointer-events-auto shrink-0"
            >
                <X className="w-5 h-5" />
            </button>
        </div>
    );
}
