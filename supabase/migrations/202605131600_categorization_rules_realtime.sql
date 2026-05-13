-- Enable realtime on categorization_rules so the settings UI updates without
-- a page refresh when a rule is added, edited, toggled, or deleted.
-- Created: 2026-05-13

do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'categorization_rules'
    ) then
        alter publication supabase_realtime add table public.categorization_rules;
    end if;
end $$;
