import React from 'react';
import { MousePointer2, Flame, Sun, Sunset, Moon, Sunrise, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

export type LightPreset = 'dawn' | 'day' | 'dusk' | 'night';

const LIGHT_CYCLE: LightPreset[] = ['dawn', 'day', 'dusk', 'night'];
const LIGHT_ICON: Record<LightPreset, React.ComponentType<{ className?: string }>> = {
    dawn: Sunrise,
    day: Sun,
    dusk: Sunset,
    night: Moon,
};

interface MapControlsProps {
    viewMode: 'pins' | 'heatmap';
    setViewMode: (mode: 'pins' | 'heatmap') => void;
    show3D: boolean;
    setShow3D: (show: boolean) => void;
    lightPreset: LightPreset;
    setLightPreset: (preset: LightPreset) => void;
    summaryActive: boolean;
    onToggleSummary: () => void;
}

export function MapControls({
    viewMode,
    setViewMode,
    show3D,
    setShow3D,
    lightPreset,
    setLightPreset,
    summaryActive,
    onToggleSummary,
}: MapControlsProps) {
    const LightIcon = LIGHT_ICON[lightPreset];
    const cycleLight = () => {
        const next = LIGHT_CYCLE[(LIGHT_CYCLE.indexOf(lightPreset) + 1) % LIGHT_CYCLE.length];
        setLightPreset(next);
    };

    return (
        <div className="flex items-center gap-2 mt-2 sm:mt-0 pointer-events-auto">
            <div className="flex p-1 rounded-full bg-card/60 backdrop-blur-md border border-white/10 shadow-lg">
                <button
                    onClick={() => setViewMode('pins')}
                    className={cn(
                        "w-11 h-11 rounded-full flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        viewMode === 'pins' ? "bg-primary text-primary-foreground shadow-inner" : "text-muted-foreground hover:bg-white/5"
                    )}
                    title="Show Pins"
                    aria-label="Show pins"
                    aria-pressed={viewMode === 'pins'}
                >
                    <MousePointer2 className="w-4 h-4" />
                </button>
                <button
                    onClick={() => setViewMode('heatmap')}
                    className={cn(
                        "w-11 h-11 rounded-full flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        viewMode === 'heatmap' ? "bg-primary text-primary-foreground shadow-inner" : "text-muted-foreground hover:bg-white/5"
                    )}
                    title="Show Heatmap"
                    aria-label="Show heatmap"
                    aria-pressed={viewMode === 'heatmap'}
                >
                    <Flame className="w-4 h-4" />
                </button>
                <button
                    onClick={() => setShow3D(!show3D)}
                    className={cn(
                        "w-11 h-11 rounded-full flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        show3D ? "bg-primary text-primary-foreground shadow-inner" : "text-muted-foreground hover:bg-white/5"
                    )}
                    title="Toggle 3D View"
                    aria-label="Toggle 3D view"
                    aria-pressed={show3D}
                >
                    <div className="relative">
                        <div className="w-3.5 h-3.5 border-2 border-current rounded-sm transform rotate-45 -translate-y-0.5" />
                        <div className="absolute inset-0 w-3.5 h-3.5 border-2 border-current rounded-sm transform rotate-45 translate-y-0.5 opacity-50" />
                    </div>
                </button>
            </div>

            <button
                onClick={onToggleSummary}
                className={cn(
                    "w-11 h-11 rounded-full flex items-center justify-center border transition-all shadow-lg backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    summaryActive
                        ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                        : "bg-card/60 border-white/10 text-muted-foreground hover:bg-white/5"
                )}
                title="Top places by spend"
                aria-label="Top places by spend"
                aria-pressed={summaryActive}
            >
                <Trophy className="w-5 h-5" />
            </button>

            <button
                onClick={cycleLight}
                className="w-11 h-11 rounded-full flex items-center justify-center border border-white/10 bg-card/60 text-muted-foreground hover:bg-white/5 transition-all shadow-lg backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                title={`Light: ${lightPreset}`}
                aria-label={`Change light preset, currently ${lightPreset}`}
            >
                <LightIcon className="w-5 h-5" />
            </button>
        </div>
    );
}
