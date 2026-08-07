-- Migration: fix delete_group — "column reference \"group_id\" is ambiguous"
--
-- Deleting a group failed outright with Postgres 42702:
--
--   code:    42702
--   message: column reference "group_id" is ambiguous
--   details: It could refer to either a PL/pgSQL variable or a table column.
--
-- The function's parameter is named `group_id`, which collides with the
-- `group_id` column on group_members / transactions / buckets. Inside plpgsql an
-- unqualified `group_id` in a WHERE clause is ambiguous, so every call aborted.
--
-- The parameter name is deliberately KEPT as `group_id`: the client calls
-- `supabase.rpc('delete_group', { group_id })` (components/providers/groups-provider.tsx),
-- and this is a PWA with an aggressive service worker — renaming the parameter would
-- break any cached client until it updated. References to it are qualified as
-- `delete_group.group_id` instead, which is unambiguous.
--
-- DROP before CREATE (same pattern as 202602151500_delete_account_rpc.sql) because
-- CREATE OR REPLACE cannot change a function's return type, and the previous
-- definition is not in this repo — it was created directly in the Supabase dashboard.

DROP FUNCTION IF EXISTS public.delete_group(UUID);

CREATE FUNCTION public.delete_group(group_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated'
            USING ERRCODE = '28000';
    END IF;

    -- Creator-only, enforced server-side. The UI already hides Delete for
    -- non-creators (group-settings-dialog.tsx `isCreator`), but RLS on `groups`
    -- is bypassed under SECURITY DEFINER so the check has to live here.
    IF NOT EXISTS (
        SELECT 1
        FROM public.groups g
        WHERE g.id = delete_group.group_id
          AND g.created_by = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Only the group creator can delete this group'
            USING ERRCODE = '42501';
    END IF;

    -- Everything downstream is already handled by foreign keys, so this single
    -- DELETE is the whole operation:
    --   group_members.group_id     ON DELETE CASCADE   (members removed)
    --   buckets.group_id           ON DELETE CASCADE   (group buckets removed)
    --   workspace_budgets.group_id ON DELETE CASCADE   (group budget removed)
    --   transactions.group_id      ON DELETE SET NULL  (shared expenses become personal)
    --   savings_goals.group_id     ON DELETE SET NULL
    --   recurring_templates.group_id / scheduled_events.group_id  ON DELETE SET NULL
    -- which matches the confirm copy: "Members are removed and shared expenses
    -- become personal."
    DELETE FROM public.groups g
    WHERE g.id = delete_group.group_id;
END;
$$;

-- PostgREST needs an explicit grant to expose the function over /rest/v1/rpc.
GRANT EXECUTE ON FUNCTION public.delete_group(UUID) TO authenticated;
