create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null default 'cliente' check (kind in ('cliente','fornecedor','parceiro','equipe')),
  name text not null,
  email text,
  phone text,
  doc text,
  note text not null default '',
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index on public.contacts (org_id, kind);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;

alter table public.contacts enable row level security;

create policy "membros leem contatos" on public.contacts for select to authenticated using (public.is_member(org_id));
create policy "membros criam contatos" on public.contacts for insert to authenticated with check (public.is_member(org_id));
create policy "membros editam contatos" on public.contacts for update to authenticated using (public.is_member(org_id)) with check (public.is_member(org_id));
create policy "membros excluem contatos" on public.contacts for delete to authenticated using (public.is_member(org_id));

alter table public.finance_entries add column if not exists contact_id uuid references public.contacts(id) on delete set null;
alter table public.cards           add column if not exists contact_id uuid references public.contacts(id) on delete set null;
alter table public.files           add column if not exists contact_id uuid references public.contacts(id) on delete set null;

create trigger update_contacts_updated_at before update on public.contacts
for each row execute function public.update_updated_at_column();

revoke execute on function public.is_member_via_goal(uuid) from anon, public;
grant execute on function public.is_member_via_goal(uuid) to authenticated, service_role;