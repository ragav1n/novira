'use client';

import { useEffect, useMemo } from 'react';
import { useUserPreferences } from './user-preferences-provider';
import { useGroups } from './groups-provider';

export function WorkspaceThemeProvider() {
    const { activeWorkspaceId } = useUserPreferences();
    const { groups } = useGroups();

    const activeWorkspace = useMemo(() => 
        activeWorkspaceId && activeWorkspaceId !== 'personal' 
            ? groups.find((g: any) => g.id === activeWorkspaceId) 
            : null
    , [activeWorkspaceId, groups]);

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
