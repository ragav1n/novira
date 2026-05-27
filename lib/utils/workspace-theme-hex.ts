/**
 * Recharts and inline SVG fills need literal hex colors — they can't read
 * Tailwind classes. This mirrors the palette in `useWorkspaceTheme` so charts
 * stay in sync with the rest of the workspace theme.
 */

export type WorkspaceColorKey = 'primary' | 'cyan' | 'emerald' | 'rose' | 'amber';

export const WORKSPACE_HEX: Record<WorkspaceColorKey, { base: string; light: string }> = {
    primary: { base: '#8A2BE2', light: '#A855F7' },
    cyan:    { base: '#06B6D4', light: '#22D3EE' },
    emerald: { base: '#10B981', light: '#34D399' },
    rose:    { base: '#F43F5E', light: '#FB7185' },
    amber:   { base: '#F59E0B', light: '#FBBF24' },
};

/** Resolve a workspace type ('couple' | 'home' | null) + default color → hex pair. */
export function resolveWorkspaceHex(
    workspaceType: string | null | undefined,
    defaultColor: WorkspaceColorKey = 'cyan',
): { base: string; light: string } {
    if (workspaceType === 'couple') return WORKSPACE_HEX.rose;
    if (workspaceType === 'home') return WORKSPACE_HEX.amber;
    return WORKSPACE_HEX[defaultColor];
}
