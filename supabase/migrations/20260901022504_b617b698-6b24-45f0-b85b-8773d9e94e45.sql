REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_member(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_member(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;