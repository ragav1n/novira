-- Friend requests, group creators leaving, and the email → profile lookup.
--
-- WHY
--   1. A sender could accept their own friend request. Two policies admitted it:
--      "Users can manage their own friendships" (FOR ALL, USING auth.uid() = user_id,
--      from 202602142300 — never dropped) and "Users can update their own
--      friendships" (USING friend_id OR user_id, 202602151300, whose own comment
--      says it was "keeping broad for now"). Neither had a WITH CHECK or a column
--      limit, so the recipient could also rewrite user_id and mint a friendship
--      between two other people. Since an accepted friendship is what lets a
--      payer charge someone (can_split_on, 202610010100), this is the gate for
--      splits too.
--      The FOR ALL policy is dropped (SELECT, INSERT and DELETE each have their own
--      policy already). UPDATE is now: recipient only, pending → accepted, and only
--      the status column. INSERT is limited to pending rows, so an accepted
--      friendship can't be inserted directly either.
--   2. A group's creator could leave it. The group then has no one who can manage
--      members, rename it or delete it, while every remaining member keeps it. A
--      BEFORE DELETE trigger now refuses the creator's own membership row while
--      anyone else is still in the group. Skipped for service-role code
--      (prepare_delete_account) and for FK cascades (delete_group deletes the
--      group, which cascades to the members) — pg_trigger_depth() > 1 there.
--      Raises with message 'GROUP_CREATOR_CANNOT_LEAVE' (SQLSTATE P0001) so the
--      client can show a specific explanation.
--   3. get_profile_by_email returns the UUID of any registered email to any
--      signed-in user (anon was already cut off in 202608220100). The UUID is what
--      the add-friend flow needs to insert the pending friendship, so it cannot
--      simply stop returning it without a client change. It is now rate-limited
--      per caller (20 lookups per rolling hour), which keeps the add-friend flow
--      working and turns "enumerate the user base by email" into a crawl. A
--      server-side request_friend_by_email RPC that never returns the id would
--      close it fully; that needs a client change and is left for later.

-- ─── 1. Friendships ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can manage their own friendships" ON public.friendships;
DROP POLICY IF EXISTS "Users can update their own friendships" ON public.friendships;
DROP POLICY IF EXISTS "Recipients can accept friend requests" ON public.friendships;

CREATE POLICY "Recipients can accept friend requests" ON public.friendships FOR UPDATE
USING      (auth.uid() = friend_id AND status = 'pending')
WITH CHECK (auth.uid() = friend_id AND status = 'accepted');

-- Without this an accepted row could simply be INSERTed, skipping the request
-- entirely. The client only ever inserts 'pending'.
DROP POLICY IF EXISTS "Users can insert their own friendships" ON public.friendships;
CREATE POLICY "Users can insert their own friendships" ON public.friendships FOR INSERT
WITH CHECK (auth.uid() = user_id AND status = 'pending' AND friend_id <> user_id);

REVOKE UPDATE ON public.friendships FROM anon, authenticated;
GRANT  UPDATE (status) ON public.friendships TO authenticated;

-- ─── 2. Creator cannot leave a group others are still in ─────────────────────

CREATE OR REPLACE FUNCTION public.group_members_creator_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL OR pg_trigger_depth() > 1 THEN
        RETURN OLD;
    END IF;

    IF EXISTS (
            SELECT 1 FROM public.groups g
            WHERE g.id = OLD.group_id AND g.created_by = OLD.user_id
       )
       AND EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = OLD.group_id AND gm.user_id <> OLD.user_id
       ) THEN
        RAISE EXCEPTION 'GROUP_CREATOR_CANNOT_LEAVE'
            USING HINT = 'Delete the group, or remove the other members first.';
    END IF;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS group_members_creator_guard ON public.group_members;
CREATE TRIGGER group_members_creator_guard
    BEFORE DELETE ON public.group_members
    FOR EACH ROW EXECUTE FUNCTION public.group_members_creator_guard();

-- ─── 3. Rate-limited email lookup ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profile_lookup_log (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    looked_up_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS profile_lookup_log_user_time_idx
    ON public.profile_lookup_log (user_id, looked_up_at DESC);

-- Written only by the SECURITY DEFINER function below; no policies on purpose.
ALTER TABLE public.profile_lookup_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profile_lookup_log FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_profile_by_email(email_input text)
RETURNS TABLE (
    id uuid,
    full_name text,
    avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_recent INT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN;
    END IF;

    SELECT count(*) INTO v_recent
    FROM public.profile_lookup_log l
    WHERE l.user_id = auth.uid()
      AND l.looked_up_at > now() - INTERVAL '1 hour';

    IF v_recent >= 20 THEN
        RAISE EXCEPTION 'Too many lookups, try again later' USING ERRCODE = '54000';
    END IF;

    INSERT INTO public.profile_lookup_log (user_id) VALUES (auth.uid());
    DELETE FROM public.profile_lookup_log l
    WHERE l.user_id = auth.uid() AND l.looked_up_at < now() - INTERVAL '1 day';

    RETURN QUERY
    SELECT p.id, p.full_name, p.avatar_url
    FROM public.profiles p
    WHERE lower(p.email) = lower(email_input);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_profile_by_email(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_profile_by_email(text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_profile_by_email(text) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.get_profile_by_email(text) TO service_role;
