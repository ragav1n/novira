'use client';

import { useEffect } from 'react';
import { useWorkspaceTheme } from '@/hooks/useWorkspaceTheme';

export function WorkspaceThemeProvider() {
    const { activeWorkspace } = useWorkspaceTheme();

    useEffect(() => {
        const root = document.documentElement;
        
        if (activeWorkspace?.type === 'couple') {
            root.classList.add('theme-couple');
            root.classList.remove('theme-home');
        } else if (activeWorkspace?.type === 'home') {
            root.classList.add('theme-home');
            root.classList.remove('theme-couple');
        } else {
            root.classList.remove('theme-couple', 'theme-home');
        }
    }, [activeWorkspace]);

    return null;
}
