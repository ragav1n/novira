import {
    Target, PiggyBank, Plane, Home, Car, GraduationCap,
    Heart, Gift, Briefcase, Sparkles, Mountain, Camera,
    type LucideIcon,
} from 'lucide-react';
import type { GoalIcon, GoalColor } from '@/types/goal';

export const GOAL_ICON_MAP: Record<GoalIcon, LucideIcon> = {
    target: Target,
    piggy: PiggyBank,
    plane: Plane,
    home: Home,
    car: Car,
    graduation: GraduationCap,
    heart: Heart,
    gift: Gift,
    briefcase: Briefcase,
    sparkles: Sparkles,
    mountain: Mountain,
    camera: Camera,
};

export type GoalColorTokens = {
    text: string;
    textLight: string;
    bg: string;
    bgLight: string;
    border: string;
    indicator: string;
    swatch: string;
    gradient: string;
};

export const GOAL_COLOR_MAP: Record<GoalColor, GoalColorTokens> = {
    emerald: {
        text: 'text-emerald-400',
        textLight: 'text-emerald-300',
        bg: 'bg-emerald-500/20',
        bgLight: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        indicator: 'bg-emerald-400',
        swatch: 'bg-emerald-500',
        gradient: 'from-emerald-500/20 to-teal-600/20',
    },
    cyan: {
        text: 'text-cyan-400',
        textLight: 'text-cyan-300',
        bg: 'bg-cyan-500/20',
        bgLight: 'bg-cyan-500/10',
        border: 'border-cyan-500/30',
        indicator: 'bg-cyan-400',
        swatch: 'bg-cyan-500',
        gradient: 'from-cyan-500/20 to-sky-600/20',
    },
    violet: {
        text: 'text-violet-400',
        textLight: 'text-violet-300',
        bg: 'bg-violet-500/20',
        bgLight: 'bg-violet-500/10',
        border: 'border-violet-500/30',
        indicator: 'bg-violet-400',
        swatch: 'bg-violet-500',
        gradient: 'from-violet-500/20 to-purple-600/20',
    },
    rose: {
        text: 'text-rose-400',
        textLight: 'text-rose-300',
        bg: 'bg-rose-500/20',
        bgLight: 'bg-rose-500/10',
        border: 'border-rose-500/30',
        indicator: 'bg-rose-400',
        swatch: 'bg-rose-500',
        gradient: 'from-rose-500/20 to-pink-600/20',
    },
    amber: {
        text: 'text-amber-400',
        textLight: 'text-amber-300',
        bg: 'bg-amber-500/20',
        bgLight: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        indicator: 'bg-amber-400',
        swatch: 'bg-amber-500',
        gradient: 'from-amber-500/20 to-orange-600/20',
    },
    sky: {
        text: 'text-sky-400',
        textLight: 'text-sky-300',
        bg: 'bg-sky-500/20',
        bgLight: 'bg-sky-500/10',
        border: 'border-sky-500/30',
        indicator: 'bg-sky-400',
        swatch: 'bg-sky-500',
        gradient: 'from-sky-500/20 to-blue-600/20',
    },
    fuchsia: {
        text: 'text-fuchsia-400',
        textLight: 'text-fuchsia-300',
        bg: 'bg-fuchsia-500/20',
        bgLight: 'bg-fuchsia-500/10',
        border: 'border-fuchsia-500/30',
        indicator: 'bg-fuchsia-400',
        swatch: 'bg-fuchsia-500',
        gradient: 'from-fuchsia-500/20 to-pink-600/20',
    },
    slate: {
        text: 'text-slate-300',
        textLight: 'text-slate-200',
        bg: 'bg-slate-500/20',
        bgLight: 'bg-slate-500/10',
        border: 'border-slate-500/30',
        indicator: 'bg-slate-400',
        swatch: 'bg-slate-500',
        gradient: 'from-slate-500/20 to-zinc-600/20',
    },
};

export function resolveGoalIcon(icon: string | null | undefined): LucideIcon {
    if (icon && icon in GOAL_ICON_MAP) return GOAL_ICON_MAP[icon as GoalIcon];
    return Target;
}

export function resolveGoalColor(color: string | null | undefined): GoalColorTokens {
    if (color && color in GOAL_COLOR_MAP) return GOAL_COLOR_MAP[color as GoalColor];
    return GOAL_COLOR_MAP.emerald;
}
