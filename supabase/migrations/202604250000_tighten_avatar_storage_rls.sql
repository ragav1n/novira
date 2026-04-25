-- Drop the broad public SELECT policy on the avatars bucket.
--
-- Why: the `avatars` bucket is `public = true`, so files are served via
-- `getPublicUrl()` without going through RLS. A SELECT RLS policy is only
-- consulted by list operations (e.g. storage.from('avatars').list()), which
-- this app never calls. Keeping the policy lets unauthenticated clients
-- enumerate every avatar filename in the bucket — an unnecessary data leak
-- flagged by Supabase Security Advisor.
--
-- After this migration: public URLs continue to work; listing is denied.

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Avatar images are publicly accessible.'
  ) then
    drop policy "Avatar images are publicly accessible." on storage.objects;
  end if;
end $$;
