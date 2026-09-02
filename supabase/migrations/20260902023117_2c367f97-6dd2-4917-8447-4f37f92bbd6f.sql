create table public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  color text not null default '#64748b',
  kind text not null default 'ambos' check (kind in ('entrada','saida','ambos')),
  position int not null default 0,
  archived boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index on public.finance_categories (org_id, project_id);
create unique index finance_categories_uniq on public.finance_categories (project_id, lower(name));

grant select, insert, update, delete on public.finance_categories to authenticated;
grant all on public.finance_categories to service_role;

alter table public.finance_categories enable row level security;
create policy "fincat_select" on public.finance_categories for select to authenticated using (public.is_member(org_id));
create policy "fincat_insert" on public.finance_categories for insert to authenticated
  with check (public.can_write(org_id) and public.is_member_via_project(project_id));
create policy "fincat_update" on public.finance_categories for update to authenticated
  using (public.can_write(org_id)) with check (public.can_write(org_id));
create policy "fincat_delete" on public.finance_categories for delete to authenticated using (public.can_delete(org_id, created_by));

alter table public.finance_entries add column if not exists category_id uuid references public.finance_categories(id) on delete set null;

do $$
declare rec record; new_cat_id uuid;
begin
  for rec in
    select distinct project_id, org_id, category
    from public.finance_entries
    where category is not null and category <> '' and project_id is not null
  loop
    insert into public.finance_categories (org_id, project_id, name, kind, created_by)
    select rec.org_id, rec.project_id, rec.category, 'ambos', o.owner_id
    from public.organizations o where o.id = rec.org_id
    on conflict (project_id, lower(name)) do nothing;

    select id into new_cat_id from public.finance_categories
    where project_id = rec.project_id and lower(name) = lower(rec.category) limit 1;

    update public.finance_entries
    set category_id = new_cat_id
    where project_id = rec.project_id and category = rec.category and category_id is null;
  end loop;
end $$;