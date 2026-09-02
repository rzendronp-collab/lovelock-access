create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  category_id uuid references public.finance_categories(id) on delete cascade,
  month date not null,
  planned numeric(14,2) not null default 0,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.budgets (org_id, project_id, month);
create unique index budgets_uniq on public.budgets (project_id, category_id, month);

grant select, insert, update, delete on public.budgets to authenticated;
grant all on public.budgets to service_role;

alter table public.budgets enable row level security;
create policy "budgets_select" on public.budgets for select to authenticated using (public.is_member(org_id));
create policy "budgets_insert" on public.budgets for insert to authenticated
  with check (public.can_write(org_id) and public.is_member_via_project(project_id));
create policy "budgets_update" on public.budgets for update to authenticated
  using (public.can_write(org_id)) with check (public.can_write(org_id));
create policy "budgets_delete" on public.budgets for delete to authenticated using (public.can_delete(org_id, created_by));

create trigger update_budgets_updated_at before update on public.budgets
  for each row execute function public.update_updated_at_column();