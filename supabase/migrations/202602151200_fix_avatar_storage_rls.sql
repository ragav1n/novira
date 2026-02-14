-- Ensure the bucket exists
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Drop existing policies to ensure a clean slate and avoid conflicts
-- We use DO blocks to avoid errors if the policies don't exist
do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Avatar images are publicly accessible.') then
    drop policy "Avatar images are publicly accessible." on storage.objects;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Anyone can upload an avatar.') then
    drop policy "Anyone can upload an avatar." on storage.objects;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Anyone can update their own avatar.') then
    drop policy "Anyone can update their own avatar." on storage.objects;
  end if;
    if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated users can upload avatars.') then
    drop policy "Authenticated users can upload avatars." on storage.objects;
  end if;
    if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated users can update avatars.') then
    drop policy "Authenticated users can update avatars." on storage.objects;
  end if;
    if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated users can delete avatars.') then
    drop policy "Authenticated users can delete avatars." on storage.objects;
  end if;
end $$;

-- Re-create policies

-- 1. Public Read Access
create policy "Avatar images are publicly accessible."
on storage.objects for select
using ( bucket_id = 'avatars' );

-- 2. Authenticated Upload (INSERT)
create policy "Authenticated users can upload avatars."
on storage.objects for insert
with check ( bucket_id = 'avatars' and auth.role() = 'authenticated' );

-- 3. Authenticated Update (UPDATE)
-- Allowing update if user owns the object OR if they are just authenticated (for simplicity/compatibility with current flow if owner is null)
create policy "Authenticated users can update avatars."
on storage.objects for update
using ( bucket_id = 'avatars' and auth.role() = 'authenticated' );

-- 4. Authenticated Delete (DELETE)
create policy "Authenticated users can delete avatars."
on storage.objects for delete
using ( bucket_id = 'avatars' and auth.role() = 'authenticated' );
