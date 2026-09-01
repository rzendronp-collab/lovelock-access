-- CORREÇÃO 0: created_by sempre preenchido
do $$
declare t text;
begin
  foreach t in array array[
    'finance_entries','fixed_costs','boards','cards','folders','files',
    'payment_accounts','payment_receipts','agenda_items','goals','contacts'
  ] loop
    execute format('alter table public.%I alter column created_by set default auth.uid()', t);
    execute format('update public.%1$I set created_by = coalesce(created_by, (select owner_id from public.organizations o where o.id = %1$I.org_id)) where created_by is null', t);
  end loop;
end $$;

-- 1. Tabela de projetos
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  color text not null default '#0E6B45',
  position int not null default 0,
  archived boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_org_idx on public.projects (org_id);

grant select, insert, update, delete on public.projects to authenticated;
grant all on public.projects to service_role;

create or replace function public.is_member_via_project(target_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects p
    where p.id = target_project and public.is_member(p.org_id)
  );
$$;

alter table public.projects enable row level security;
create policy "membros leem projetos" on public.projects for select to authenticated using (public.is_member(org_id));
create policy "escrita projetos" on public.projects for insert to authenticated with check (public.can_write(org_id));
create policy "edicao projetos" on public.projects for update to authenticated using (public.can_write(org_id)) with check (public.can_write(org_id));
create policy "exclusao projetos" on public.projects for delete to authenticated using (public.can_delete(org_id, created_by));

create trigger update_projects_updated_at before update on public.projects
for each row execute function public.update_updated_at_column();

-- 2. project_id nos módulos POR PROJETO
alter table public.finance_entries  add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table public.fixed_costs      add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table public.boards           add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table public.payment_accounts add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table public.payment_receipts add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table public.goals            add column if not exists project_id uuid references public.projects(id) on delete cascade;

-- 3. cash_opening por projeto
alter table public.cash_opening add column if not exists project_id uuid references public.projects(id) on delete cascade;
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'cash_opening_org_id_key') then
    alter table public.cash_opening drop constraint cash_opening_org_id_key;
  end if;
end $$;
create unique index if not exists cash_opening_project_uidx on public.cash_opening (project_id) where project_id is not null;

-- 4. project_id opcional nos módulos globais com filtro
alter table public.agenda_items add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.folders      add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.files        add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists finance_entries_project_idx on public.finance_entries (project_id);
create index if not exists fixed_costs_project_idx on public.fixed_costs (project_id);
create index if not exists boards_project_idx on public.boards (project_id);
create index if not exists payment_accounts_project_idx on public.payment_accounts (project_id);
create index if not exists payment_receipts_project_idx on public.payment_receipts (project_id);
create index if not exists goals_project_idx on public.goals (project_id);
create index if not exists agenda_project_idx on public.agenda_items (project_id);
create index if not exists folders_project_idx on public.folders (project_id);
create index if not exists files_project_idx on public.files (project_id);

-- 5. INTEGRIDADE: insert só aponta para projeto da própria empresa
drop policy if exists "escrita restrita lancamentos" on public.finance_entries;
create policy "finance_entries_insert" on public.finance_entries for insert to authenticated
with check (public.can_write(org_id) and (project_id is null or public.is_member_via_project(project_id)));

drop policy if exists "escrita restrita fixos" on public.fixed_costs;
create policy "fixed_costs_insert" on public.fixed_costs for insert to authenticated
with check (public.can_write(org_id) and (project_id is null or public.is_member_via_project(project_id)));

drop policy if exists "escrita restrita quadros" on public.boards;
create policy "boards_insert" on public.boards for insert to authenticated
with check (public.can_write(org_id) and (project_id is null or public.is_member_via_project(project_id)));

drop policy if exists "escrita restrita contas recebimento" on public.payment_accounts;
create policy "payment_accounts_insert" on public.payment_accounts for insert to authenticated
with check (public.can_write(org_id) and (project_id is null or public.is_member_via_project(project_id)));

drop policy if exists "escrita restrita recebimentos" on public.payment_receipts;
create policy "payment_receipts_insert" on public.payment_receipts for insert to authenticated
with check (public.can_write(org_id) and (project_id is null or public.is_member_via_project(project_id)));

drop policy if exists "escrita restrita metas" on public.goals;
create policy "goals_insert" on public.goals for insert to authenticated
with check (public.can_write(org_id) and (project_id is null or public.is_member_via_project(project_id)));

drop policy if exists "escrita restrita saldo inicial" on public.cash_opening;
create policy "cash_opening_insert" on public.cash_opening for insert to authenticated
with check (public.can_write(org_id) and (project_id is null or public.is_member_via_project(project_id)));

drop policy if exists "escrita restrita agenda" on public.agenda_items;
create policy "agenda_items_insert" on public.agenda_items for insert to authenticated
with check (public.can_write(org_id) and (project_id is null or public.is_member_via_project(project_id)));

drop policy if exists "escrita restrita pastas" on public.folders;
create policy "folders_insert" on public.folders for insert to authenticated
with check (public.can_write(org_id) and (project_id is null or public.is_member_via_project(project_id)));

drop policy if exists "escrita restrita arquivos" on public.files;
create policy "files_insert" on public.files for insert to authenticated
with check (public.can_write(org_id) and (project_id is null or public.is_member_via_project(project_id)));