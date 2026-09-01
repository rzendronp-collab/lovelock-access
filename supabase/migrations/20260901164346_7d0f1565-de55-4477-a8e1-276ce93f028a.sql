create table public.mindmaps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null default 'Novo mapa',
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  viewport jsonb,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.mindmaps (org_id);
create index on public.mindmaps (project_id);

grant select, insert, update, delete on public.mindmaps to authenticated;
grant all on public.mindmaps to service_role;

alter table public.mindmaps enable row level security;
create policy "mindmaps_select" on public.mindmaps for select to authenticated using (public.is_member(org_id));
create policy "mindmaps_insert" on public.mindmaps for insert to authenticated
  with check (public.can_write(org_id) and (project_id is null or public.is_member_via_project(project_id)));
create policy "mindmaps_update" on public.mindmaps for update to authenticated
  using (public.can_write(org_id)) with check (public.can_write(org_id));
create policy "mindmaps_delete" on public.mindmaps for delete to authenticated using (public.can_delete(org_id, created_by));

create trigger update_mindmaps_updated_at before update on public.mindmaps
  for each row execute function public.update_updated_at_column();