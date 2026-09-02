alter table public.finance_entries add column if not exists is_withdrawal boolean not null default false;

create table public.withdrawal_settings (
  project_id uuid primary key references public.projects(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  percent numeric(5,2) not null default 40.00,
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.withdrawal_settings to authenticated;
grant all on public.withdrawal_settings to service_role;

alter table public.withdrawal_settings enable row level security;

create policy "wsettings_select" on public.withdrawal_settings for select to authenticated using (public.is_member(org_id));
create policy "wsettings_insert" on public.withdrawal_settings for insert to authenticated
  with check (public.is_admin_or_owner(org_id) and public.is_member_via_project(project_id));
create policy "wsettings_update" on public.withdrawal_settings for update to authenticated
  using (public.is_admin_or_owner(org_id)) with check (public.is_admin_or_owner(org_id));

create trigger update_withdrawal_settings_updated_at before update on public.withdrawal_settings
  for each row execute function public.update_updated_at_column();