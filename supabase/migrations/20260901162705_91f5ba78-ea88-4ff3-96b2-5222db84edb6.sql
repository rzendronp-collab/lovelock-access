create table public.notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null default '',
  content text not null default '',
  color text not null default '#F5D90A',
  pinned boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.notes (org_id);
create index on public.notes (project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;

alter table public.notes enable row level security;
create policy "notes_select" on public.notes for select to authenticated using (public.is_member(org_id));
create policy "notes_insert" on public.notes for insert to authenticated
  with check (public.can_write(org_id) and (project_id is null or public.is_member_via_project(project_id)));
create policy "notes_update" on public.notes for update to authenticated
  using (public.can_write(org_id)) with check (public.can_write(org_id));
create policy "notes_delete" on public.notes for delete to authenticated using (public.can_delete(org_id, created_by));

create trigger update_notes_updated_at before update on public.notes
  for each row execute function public.update_updated_at_column();

create table public.kb_collections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  name text not null,
  color text not null default '#0E6B45',
  position int not null default 0,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index on public.kb_collections (org_id);

create table public.kb_articles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  collection_id uuid references public.kb_collections(id) on delete set null,
  title text not null,
  content text not null default '',
  tags text[] not null default '{}',
  pinned boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.kb_articles (org_id);
create index on public.kb_articles (collection_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_collections TO authenticated;
GRANT ALL ON public.kb_collections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_articles TO authenticated;
GRANT ALL ON public.kb_articles TO service_role;

alter table public.kb_collections enable row level security;
alter table public.kb_articles    enable row level security;

create policy "kb_col_select" on public.kb_collections for select to authenticated using (public.is_member(org_id));
create policy "kb_col_insert" on public.kb_collections for insert to authenticated
  with check (public.can_write(org_id) and (project_id is null or public.is_member_via_project(project_id)));
create policy "kb_col_update" on public.kb_collections for update to authenticated
  using (public.can_write(org_id)) with check (public.can_write(org_id));
create policy "kb_col_delete" on public.kb_collections for delete to authenticated using (public.can_delete(org_id, created_by));

create policy "kb_art_select" on public.kb_articles for select to authenticated using (public.is_member(org_id));
create policy "kb_art_insert" on public.kb_articles for insert to authenticated
  with check (public.can_write(org_id) and (project_id is null or public.is_member_via_project(project_id)));
create policy "kb_art_update" on public.kb_articles for update to authenticated
  using (public.can_write(org_id)) with check (public.can_write(org_id));
create policy "kb_art_delete" on public.kb_articles for delete to authenticated using (public.can_delete(org_id, created_by));

create trigger update_kb_articles_updated_at before update on public.kb_articles
  for each row execute function public.update_updated_at_column();