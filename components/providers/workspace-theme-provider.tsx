'use client';

import { useEffect, useRef } from 'react';
import { useWorkspaceTheme } from '@/hooks/useWorkspaceTheme';

const TRANSITION_MS = 400;

export function WorkspaceThemeProvider() {
    const { activeWorkspace } = useWorkspaceTheme();
    const lastTypeRef = useRef<string | null | undefined>(undefined);
    const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const root = document.documentElement;
        const body = document.body;
        const nextType = activeWorkspace?.type ?? null;

        // Skip the very first apply so we don't tween from "nothing" → initial
        // workspace state on page load (it'd flash).
        const isFirstApply = lastTypeRef.current === undefined;
        const typeChanged = !isFirstApply && lastTypeRef.current !== nextType;

        if (typeChanged) {
            body.classList.add('theme-transitioning');
            if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
            cleanupTimerRef.current = setTimeout(() => {
                body.classList.remove('theme-transitioning');
                cleanupTimerRef.current = null;
            }, TRANSITION_MS);
        }

        if (nextType === 'couple') {
            root.classList.add('theme-couple');
            root.classList.remove('theme-home');
        } else if (nextType === 'home') {
            root.classList.add('theme-home');
            root.classList.remove('theme-couple');
        } else {
            root.classList.remove('theme-couple', 'theme-home');
        }

        lastTypeRef.current = nextType;
    }, [activeWorkspace]);

    useEffect(() => {
        return () => {
            if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
        };
    }, []);

    return null;
}
