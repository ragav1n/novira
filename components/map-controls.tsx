import React from 'react';
import { MousePointer2, Flame, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MapControlsProps {
    viewMode: 'pins' | 'heatmap';
    setViewMode: (mode: 'pins' | 'heatmap') => void;
    show3D: boolean;
    setShow3D: (show: boolean) => void;
    showTrails: boolean;
    setShowTrails: (show: boolean) => void;
}

export function MapControls({
    viewMode,
    setViewMode,
    show3D,
    setShow3D,
    showTrails,
    setShowTrails
}: MapControlsProps) {
    return (
        <div className="flex items-center gap-2 mt-2 sm:mt-0 pointer-events-auto">
            <div className="flex p-1 rounded-full bg-card/60 backdrop-blur-md border border-white/10 shadow-lg">
                <button
                    onClick={() => setViewMode('pins')}
                    className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center transition-all",
                        viewMode === 'pins' ? "bg-primary text-primary-foreground shadow-inner" : "text-muted-foreground hover:bg-white/5"
                    )}
                    title="Show Pins"
                >
                    <MousePointer2 className="w-4 h-4" />
                </button>
                <button
                    onClick={() => setViewMode('heatmap')}
                    className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center transition-all",
                        viewMode === 'heatmap' ? "bg-primary text-primary-foreground shadow-inner" : "text-muted-foreground hover:bg-white/5"
                    )}
                    title="Show Heatmap"
                >
                    <Flame className="w-4 h-4" />
                </button>
                <button
                    onClick={() => setShow3D(!show3D)}
                    className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center transition-all",
                        show3D ? "bg-primary text-primary-foreground shadow-inner" : "text-muted-foreground hover:bg-white/5"
                    )}
                    title="Toggle 3D View"
                >
                    <div className="relative">
                        <div className="w-3.5 h-3.5 border-2 border-current rounded-sm transform rotate-45 -translate-y-0.5" />
                        <div className="absolute inset-0 w-3.5 h-3.5 border-2 border-current rounded-sm transform rotate-45 translate-y-0.5 opacity-50" />
                    </div>
                </button>
            </div>

            <button
                onClick={() => setShowTrails(!showTrails)}
                className={cn(
                    "w-11 h-11 rounded-full flex items-center justify-center border transition-all shadow-lg backdrop-blur-md",
                    showTrails 
                        ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400" 
                        : "bg-card/60 border-white/10 text-muted-foreground hover:bg-white/5"
                )}
                title="Toggle Spending Trails"
            >
                <Zap className={cn("w-5 h-5", showTrails && "fill-current animate-pulse")} />
            </button>
        </div>
    );
}
