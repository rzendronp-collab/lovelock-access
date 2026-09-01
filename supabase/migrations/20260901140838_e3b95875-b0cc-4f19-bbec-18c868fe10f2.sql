REVOKE EXECUTE ON FUNCTION public.is_admin_or_owner(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_admin_or_owner(uuid) TO authenticated, service_role;