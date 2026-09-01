create table public.goals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  group_name text not null default '',
  target numeric(14,2) not null default 0,
  current_source text not null default 'manual',
  unit text not null default 'R$' check (unit in ('R$','%','unidade')),
  due_date date,
  color text not null default '#64748b',
  note text not null default '',
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.goal_tasks (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  text text not null,
  done boolean not null default false,
  card_id uuid references public.cards(id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function public.is_member_via_goal(target_goal uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.goals g where g.id = target_goal and public.is_member(g.org_id));
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_tasks TO authenticated;
GRANT ALL ON public.goal_tasks TO service_role;

alter table public.goals      enable row level security;
alter table public.goal_tasks enable row level security;

create policy "membros leem metas" on public.goals for select to authenticated using (public.is_member(org_id));
create policy "membros criam metas" on public.goals for insert to authenticated with check (public.is_member(org_id));
create policy "membros editam metas" on public.goals for update to authenticated using (public.is_member(org_id)) with check (public.is_member(org_id));
create policy "membros excluem metas" on public.goals for delete to authenticated using (public.is_member(org_id));

create policy "membros leem tarefas de meta" on public.goal_tasks for select to authenticated using (public.is_member_via_goal(goal_id));
create policy "membros criam tarefas de meta" on public.goal_tasks for insert to authenticated with check (public.is_member_via_goal(goal_id));
create policy "membros editam tarefas de meta" on public.goal_tasks for update to authenticated using (public.is_member_via_goal(goal_id)) with check (public.is_member_via_goal(goal_id));
create policy "membros excluem tarefas de meta" on public.goal_tasks for delete to authenticated using (public.is_member_via_goal(goal_id));

create trigger update_goals_updated_at before update on public.goals
for each row execute function public.update_updated_at_column();