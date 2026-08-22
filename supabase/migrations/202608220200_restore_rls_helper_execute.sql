-- Migration: give anon back EXECUTE on the three RLS helper functions
-- Date: 2026-08-22
--
-- Regression from 202608220100. That migration revoked EXECUTE from anon across
-- every SECURITY DEFINER function, but three of them are called from *inside* RLS
-- policies (USING / WITH CHECK):
--
--   get_transaction_user_id  -> policies on splits
--   is_group_member          -> policies on groups, group_members, transaction_history
--   is_group_creator         -> policies on group_members
--
-- A policy is evaluated as the role running the query, so removing anon's EXECUTE
-- turned a filtered-empty read into a hard error: an anonymous
-- `GET /rest/v1/transactions` went from `200 []` to
-- `401 permission denied for function get_transaction_user_id`.
--
-- That is a functional regression rather than a security improvement. RLS already
-- returns zero rows to an anonymous caller, because every one of those predicates
-- compares against auth.uid(), which is NULL for anon. The revoke changed the
-- shape of the failure, not what data was reachable — and a 401 where the client
-- expects an empty list is exactly the kind of thing that surfaces as a broken
-- loading state.
--
-- Direct-call exposure is negligible and unchanged in kind: all three take uuids
-- the caller would already have to know, return a single uuid or a boolean, and
-- write nothing. Hardening those is a separate question from this privilege sweep,
-- and bundling it here is what caused the mistake in the first place.
--
-- 202608220100 has been patched to match, so a fresh apply gets this right in one
-- pass and this migration is then a no-op. Idempotent either way.

DO $do$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN ('get_transaction_user_id', 'is_group_member', 'is_group_creator')
    LOOP
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', r.sig);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END LOOP;
END
$do$;
