-- Durable rate limiting for the paid AI routes (recap generation, insights chat,
-- receipt scan). lib/server/rate-limit.ts kept its counters in an in-memory Map,
-- which is per serverless instance: every cold start and every parallel instance
-- handed out a fresh quota. This is a fixed-window counter in the database,
-- incremented atomically by one RPC call.
--
-- Only the service role can touch it. The client never calls the RPC; the route
-- handlers call it with the service-role key after authenticating the user.

create table if not exists public.rate_limit_counters (
    bucket       text        not null,
    key          text        not null,
    window_start timestamptz not null,
    hits         integer     not null default 0,
    primary key (bucket, key, window_start)
);

alter table public.rate_limit_counters enable row level security;
-- No policies: anon/authenticated get nothing. The service role bypasses RLS.

create or replace function public.rate_limit_hit(
    p_bucket    text,
    p_key       text,
    p_window_ms bigint,
    p_max       integer
) returns table (hit_count integer, window_started timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_start timestamptz;
    v_hits  integer;
begin
    v_start := to_timestamp(
        floor(extract(epoch from now()) * 1000 / p_window_ms) * p_window_ms / 1000.0
    );

    -- Count the attempt only while under the limit, so a client hammering a
    -- closed window doesn't push its own counter (and the table) upward forever.
    insert into public.rate_limit_counters as c (bucket, key, window_start, hits)
    values (p_bucket, p_key, v_start, 1)
    -- Named constraint, not a column list: OUT params share a namespace with
    -- columns in plpgsql, and an ambiguous name here is a 42702 at runtime.
    on conflict on constraint rate_limit_counters_pkey
    do update set hits = c.hits + 1 where c.hits < p_max
    returning c.hits into v_hits;

    if v_hits is null then
        -- Conflict row existed and was already at the limit.
        v_hits := p_max + 1;
    end if;

    -- Opportunistic cleanup of windows older than a day past their end.
    if random() < 0.01 then
        delete from public.rate_limit_counters
        where rate_limit_counters.window_start < now() - interval '2 days';
    end if;

    return query select v_hits, v_start;
end;
$$;

revoke all on function public.rate_limit_hit(text, text, bigint, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, text, bigint, integer) to service_role;
revoke all on table public.rate_limit_counters from public, anon, authenticated;
