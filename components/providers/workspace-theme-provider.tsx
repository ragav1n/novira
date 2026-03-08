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
        root.classList.remove('theme-couple', 'theme-home');
        
        if (activeWorkspace?.type === 'couple') {
            root.classList.add('theme-couple');
        } else if (activeWorkspace?.type === 'home') {
            root.classList.add('theme-home');
        }
    }, [activeWorkspace]);

    return null;
}
