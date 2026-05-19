-- Atomic batch settlement
-- Created: 2026-05-19
--
-- settleSplitsBatch in the groups provider calls this RPC, but it was never
-- created — so every "Settle All" / "Mark Received" hit the missing-function
-- path. PostgREST reports a missing function as PGRST202 ("Could not find the
-- function ... in the schema cache"), which the client's fallback detection
-- did not recognise, so the action surfaced an error instead of falling back
-- to the per-split loop.
--
-- Create the function so the happy path works. It is atomic: a failure on any
-- split rolls the whole call back, so the user never ends up half-settled.

create or replace function public.settle_splits_batch(split_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_id uuid;
    v_count integer := 0;
begin
    foreach v_id in array split_ids loop
        perform public.settle_split(v_id);
        v_count := v_count + 1;
    end loop;
    return v_count;
end;
$$;
