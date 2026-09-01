create or replace function public.vault_store_secret(p_name text, p_secret text)
returns text
language plpgsql
security definer
set search_path = public, vault, extensions
as $$
declare
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = p_name;
  if v_id is null then
    perform vault.create_secret(p_secret, p_name, 'stripe secret key');
  else
    perform vault.update_secret(v_id, p_secret, p_name, 'stripe secret key');
  end if;
  return p_name;
end;
$$;

create or replace function public.vault_read_secret(p_name text)
returns text
language sql
security definer
set search_path = public, vault, extensions
as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_name limit 1;
$$;

revoke all on function public.vault_store_secret(text, text) from public, anon, authenticated;
revoke all on function public.vault_read_secret(text) from public, anon, authenticated;
grant execute on function public.vault_store_secret(text, text) to service_role;
grant execute on function public.vault_read_secret(text) to service_role;