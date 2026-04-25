-- Create the push_subscriptions table backing /api/push/subscribe and /api/push/send.
--
-- Why: the API route handlers (app/api/push/{subscribe,send}/route.ts) read and
-- write this table, but no migration ever created it. Without this table, every
-- subscribe attempt 500s and the push notifications feature is dead on arrival.
--
-- Schema mirrors what the route handlers expect:
--   - endpoint:  the push service URL (unique per browser/install).
--   - user_id:   owner of the subscription.
--   - p256dh, auth: the encryption keys returned by PushManager.subscribe().
--
-- RLS: users have full CRUD on their own subscriptions (matches subscribe
-- endpoint behavior). The send endpoint, if called server-to-server, must use
-- a service-role client to query across users — service-role bypasses RLS, so
-- no extra policy is needed for that path.

create table if not exists public.push_subscriptions (
    endpoint    text primary key,
    user_id     uuid not null references auth.users(id) on delete cascade,
    p256dh      text not null,
    auth        text not null,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx
    on public.push_subscriptions (user_id);

-- Keep updated_at fresh on upsert
create or replace function public.touch_push_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;
create trigger push_subscriptions_set_updated_at
    before update on public.push_subscriptions
    for each row execute procedure public.touch_push_subscriptions_updated_at();

-- Enable RLS
alter table public.push_subscriptions enable row level security;

-- Users can manage only their own subscriptions
drop policy if exists "Users can read their own push subscriptions"
    on public.push_subscriptions;
create policy "Users can read their own push subscriptions"
    on public.push_subscriptions
    for select
    to authenticated
    using (auth.uid() = user_id);

drop policy if exists "Users can insert their own push subscriptions"
    on public.push_subscriptions;
create policy "Users can insert their own push subscriptions"
    on public.push_subscriptions
    for insert
    to authenticated
    with check (auth.uid() = user_id);

drop policy if exists "Users can update their own push subscriptions"
    on public.push_subscriptions;
create policy "Users can update their own push subscriptions"
    on public.push_subscriptions
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own push subscriptions"
    on public.push_subscriptions;
create policy "Users can delete their own push subscriptions"
    on public.push_subscriptions
    for delete
    to authenticated
    using (auth.uid() = user_id);
