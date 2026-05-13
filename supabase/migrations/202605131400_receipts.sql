-- Add receipt photo attach to transactions
-- Created: 2026-05-13
--
-- Adds a private `receipts` storage bucket plus a `receipt_path` column on
-- `transactions` so users can persist the original receipt image/PDF alongside
-- the row and view it again later.
--
-- Path convention: `${user_id}/${tx_id}.${ext}` — owner-folder enforced by RLS.
-- Bucket is private; reads happen via short-lived signed URLs from the client.

-- 1. Add receipt_path column
alter table public.transactions
    add column if not exists receipt_path text;

-- 2. Create the private bucket
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- 3. RLS — owner-folder model
--    A user can only touch objects in receipts/${their-uid}/* .
do $$
begin
    if exists (
        select 1 from pg_policies
        where schemaname = 'storage' and tablename = 'objects'
              and policyname = 'Receipts: owner read'
    ) then
        drop policy "Receipts: owner read" on storage.objects;
    end if;
    if exists (
        select 1 from pg_policies
        where schemaname = 'storage' and tablename = 'objects'
              and policyname = 'Receipts: owner insert'
    ) then
        drop policy "Receipts: owner insert" on storage.objects;
    end if;
    if exists (
        select 1 from pg_policies
        where schemaname = 'storage' and tablename = 'objects'
              and policyname = 'Receipts: owner update'
    ) then
        drop policy "Receipts: owner update" on storage.objects;
    end if;
    if exists (
        select 1 from pg_policies
        where schemaname = 'storage' and tablename = 'objects'
              and policyname = 'Receipts: owner delete'
    ) then
        drop policy "Receipts: owner delete" on storage.objects;
    end if;
end $$;

create policy "Receipts: owner read"
    on storage.objects for select
    using (
        bucket_id = 'receipts'
        and auth.role() = 'authenticated'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

create policy "Receipts: owner insert"
    on storage.objects for insert
    with check (
        bucket_id = 'receipts'
        and auth.role() = 'authenticated'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

create policy "Receipts: owner update"
    on storage.objects for update
    using (
        bucket_id = 'receipts'
        and auth.role() = 'authenticated'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

create policy "Receipts: owner delete"
    on storage.objects for delete
    using (
        bucket_id = 'receipts'
        and auth.role() = 'authenticated'
        and (storage.foldername(name))[1] = auth.uid()::text
    );
