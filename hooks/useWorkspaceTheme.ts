import { useMemo } from 'react';
import { useGroups } from '@/components/providers/groups-provider';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';

export type WorkspaceTheme = {
    text: string;
    textLight: string;
    textOpacity: string;
    textWhite: string;
    bg: string;
    bgLight: string;
    bgMedium: string;
    bgSolid: string;
    border: string;
    borderLight: string;
    borderMedium: string;
    borderSolid: string;
    borderGlow: string;
    ring: string;
    hoverBg: string;
    hoverBtnBg: string;
    shadowGlow: string;
    shadowStrong: string;
    gradient: string;
    headerBg: string;
    indicatorEmpty: string;
    indicatorFull: string;
};

const COUPLE_THEME: WorkspaceTheme = {
    text: 'text-rose-500',
    textLight: 'text-rose-400',
    textOpacity: 'text-rose-500/60',
    textWhite: 'text-white',
    bg: 'bg-rose-500/20',
    bgLight: 'bg-rose-500/10',
    bgMedium: 'bg-rose-500/20',
    bgSolid: 'bg-rose-500',
    border: 'border-rose-500/20',
    borderLight: 'border-rose-500/10',
    borderMedium: 'border-rose-500/20',
    borderSolid: 'border-rose-500',
    borderGlow: 'border-rose-500/30',
    ring: 'focus-visible:ring-rose-500/50',
    hoverBg: 'hover:bg-rose-500/30',
    hoverBtnBg: 'hover:bg-rose-600',
    shadowGlow: 'shadow-rose-500/20',
    shadowStrong: 'shadow-[0_0_15px_rgba(244,63,94,0.3)]',
    gradient: 'from-rose-500/20 to-pink-600/20',
    headerBg: 'bg-rose-500/20',
    indicatorEmpty: 'bg-rose-500',
    indicatorFull: 'bg-rose-400',
};

const HOME_THEME: WorkspaceTheme = {
    text: 'text-amber-500',
    textLight: 'text-amber-400',
    textOpacity: 'text-amber-500/60',
    textWhite: 'text-white',
    bg: 'bg-amber-500/20',
    bgLight: 'bg-amber-500/10',
    bgMedium: 'bg-amber-500/20',
    bgSolid: 'bg-amber-500',
    border: 'border-amber-500/20',
    borderLight: 'border-amber-500/10',
    borderMedium: 'border-amber-500/20',
    borderSolid: 'border-amber-500',
    borderGlow: 'border-amber-500/30',
    ring: 'focus-visible:ring-amber-500/50',
    hoverBg: 'hover:bg-amber-500/30',
    hoverBtnBg: 'hover:bg-amber-600',
    shadowGlow: 'shadow-amber-500/20',
    shadowStrong: 'shadow-[0_0_15px_rgba(245,158,11,0.3)]',
    gradient: 'from-amber-500/20 to-yellow-600/20',
    headerBg: 'bg-amber-500/20',
    indicatorEmpty: 'bg-amber-500',
    indicatorFull: 'bg-amber-400',
};

const DEFAULT_THEMES: Record<'primary' | 'cyan' | 'emerald', WorkspaceTheme> = {
    primary: {
        text: 'text-primary',
        textLight: 'text-primary/80',
        textOpacity: 'text-primary/60',
        textWhite: 'text-white',
        bg: 'bg-primary/20',
        bgLight: 'bg-primary/10',
        bgMedium: 'bg-primary/20',
        bgSolid: 'bg-primary',
        border: 'border-primary/20',
        borderLight: 'border-primary/10',
        borderMedium: 'border-primary/20',
        borderSolid: 'border-primary',
        borderGlow: 'border-primary/30',
        ring: 'focus-visible:ring-primary/50',
        hoverBg: 'hover:bg-primary/30',
        hoverBtnBg: 'hover:bg-primary/90',
        shadowGlow: 'shadow-primary/20',
        shadowStrong: 'shadow-[0_0_15px_rgba(138,43,226,0.3)]',
        gradient: 'from-[#8A2BE2]/20 to-[#4B0082]/20',
        headerBg: 'bg-primary/20',
        indicatorEmpty: 'bg-primary',
        indicatorFull: 'bg-primary/80',
    },
    cyan: {
        text: 'text-cyan-500',
        textLight: 'text-cyan-400',
        textOpacity: 'text-cyan-500/60',
        textWhite: 'text-white',
        bg: 'bg-cyan-500/20',
        bgLight: 'bg-cyan-500/10',
        bgMedium: 'bg-cyan-500/20',
        bgSolid: 'bg-cyan-500',
        border: 'border-cyan-500/20',
        borderLight: 'border-cyan-500/10',
        borderMedium: 'border-cyan-500/20',
        borderSolid: 'border-cyan-500',
        borderGlow: 'border-cyan-500/30',
        ring: 'focus-visible:ring-cyan-500/50',
        hoverBg: 'hover:bg-cyan-500/30',
        hoverBtnBg: 'hover:bg-cyan-600',
        shadowGlow: 'shadow-[0_0_20px_rgba(6,182,212,0.05)]',
        shadowStrong: 'shadow-[0_0_15px_rgba(6,182,212,0.3)]',
        gradient: 'from-cyan-500/20 to-teal-600/20',
        headerBg: 'bg-cyan-500/20',
        indicatorEmpty: 'bg-cyan-500',
        indicatorFull: 'bg-cyan-400',
    },
    emerald: {
        text: 'text-emerald-500',
        textLight: 'text-emerald-400',
        textOpacity: 'text-emerald-100/80',
        textWhite: 'text-white',
        bg: 'bg-emerald-500/20',
        bgLight: 'bg-emerald-500/10',
        bgMedium: 'bg-emerald-500/20',
        bgSolid: 'bg-emerald-500',
        border: 'border-emerald-500/20',
        borderLight: 'border-emerald-500/10',
        borderMedium: 'border-emerald-500/20',
        borderSolid: 'border-emerald-500',
        borderGlow: 'border-emerald-500/30',
        ring: 'focus-visible:ring-emerald-500/50',
        hoverBg: 'hover:bg-emerald-500/30',
        hoverBtnBg: 'hover:bg-emerald-600',
        shadowGlow: 'shadow-emerald-500/20',
        shadowStrong: 'shadow-[0_0_15px_rgba(16,185,129,0.3)]',
        gradient: 'from-emerald-600/20 to-teal-800/20',
        headerBg: 'bg-emerald-500/20',
        indicatorEmpty: 'bg-emerald-500',
        indicatorFull: 'bg-emerald-400',
    },
};

export function useWorkspaceTheme(defaultColor: 'primary' | 'cyan' | 'emerald' = 'primary') {
    const { activeWorkspaceId } = useUserPreferences();
    const { groups } = useGroups();

    const activeWorkspace = useMemo(() =>
        activeWorkspaceId && activeWorkspaceId !== 'personal'
            ? groups.find(g => g.id === activeWorkspaceId) ?? null
            : null,
        [activeWorkspaceId, groups]
    );

    const theme = useMemo(() => {
        if (activeWorkspace?.type === 'couple') return COUPLE_THEME;
        if (activeWorkspace?.type === 'home') return HOME_THEME;
        return DEFAULT_THEMES[defaultColor];
    }, [activeWorkspace, defaultColor]);

    return { activeWorkspace, workspaceType: activeWorkspace?.type ?? null, theme };
}
