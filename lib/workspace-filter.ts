/**
 * Standard workspace scope for a Supabase query.
 *
 * - workspaceId set  → rows in that group, regardless of author.
 * - workspaceId null → rows authored by this user (personal + their group contributions).
 *
 * Add `.is('group_id', null)` after this call if you need the strict
 * "personal-only, no group rows" view — the UI doesn't currently expose it.
 */
export function applyWorkspaceFilter<T extends { eq: (col: string, val: string) => T }>(
    query: T,
    userId: string,
    workspaceId: string | null,
): T {
    return workspaceId
        ? query.eq('group_id', workspaceId)
        : query.eq('user_id', userId);
}
