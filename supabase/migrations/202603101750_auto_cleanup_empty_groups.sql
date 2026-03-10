-- Function to delete group if it has no members
CREATE OR REPLACE FUNCTION public.delete_empty_group()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.group_members 
        WHERE group_id = OLD.group_id
    ) THEN
        DELETE FROM public.groups WHERE id = OLD.group_id;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger AFTER DELETE on group_members
DROP TRIGGER IF EXISTS cleanup_empty_groups ON public.group_members;
CREATE TRIGGER cleanup_empty_groups
AFTER DELETE ON public.group_members
FOR EACH ROW EXECUTE PROCEDURE public.delete_empty_group();
