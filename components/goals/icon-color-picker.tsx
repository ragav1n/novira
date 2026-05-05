'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import {
    GOAL_ICON_MAP,
    GOAL_COLOR_MAP,
    resolveGoalColor,
} from '@/lib/goal-styles';
import {
    GOAL_ICON_KEYS, GOAL_COLOR_KEYS,
    type GoalIcon, type GoalColor,
} from '@/types/goal';

type Props = {
    icon: GoalIcon;
    color: GoalColor;
    onIconChange: (icon: GoalIcon) => void;
    onColorChange: (color: GoalColor) => void;
};

export function IconColorPicker({ icon, color, onIconChange, onColorChange }: Props) {
    const tokens = resolveGoalColor(color);
    return (
        <div className="space-y-3">
            <div className="space-y-1">
                <Label className="text-xs">Icon</Label>
                <div className="grid grid-cols-6 gap-1.5">
                    {GOAL_ICON_KEYS.map(key => {
                        const Ico = GOAL_ICON_MAP[key];
                        const active = key === icon;
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => onIconChange(key)}
                                aria-label={`Pick ${key} icon`}
                                aria-pressed={active}
                                className={cn(
                                    'h-9 rounded-xl border flex items-center justify-center transition-colors',
                                    active
                                        ? `${tokens.bg} ${tokens.border} ${tokens.text}`
                                        : 'bg-secondary/20 border-white/10 text-muted-foreground hover:text-foreground'
                                )}
                            >
                                <Ico className="w-4 h-4" />
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className="space-y-1">
                <Label className="text-xs">Color</Label>
                <div className="flex flex-wrap gap-2">
                    {GOAL_COLOR_KEYS.map(key => {
                        const t = GOAL_COLOR_MAP[key];
                        const active = key === color;
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => onColorChange(key)}
                                aria-label={`Pick ${key} color`}
                                aria-pressed={active}
                                className={cn(
                                    'w-8 h-8 rounded-full flex items-center justify-center transition-transform',
                                    t.swatch,
                                    active ? 'ring-2 ring-white/80 scale-110' : 'opacity-70 hover:opacity-100'
                                )}
                            >
                                {active && <Check className="w-4 h-4 text-white" aria-hidden="true" />}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
