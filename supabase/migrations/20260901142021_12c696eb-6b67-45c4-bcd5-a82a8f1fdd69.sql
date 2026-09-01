create table public.agenda_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  date date not null,
  time time,
  kind text not null default 'tarefa' check (kind in ('tarefa','prazo','recado')),
  note text not null default '',
  color text not null default '#64748b',
  done boolean not null default false,
  assignee_id uuid references auth.users(id),
  source_type text,
  source_id uuid,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index on public.agenda_items (org_id, date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_items TO authenticated;
GRANT ALL ON public.agenda_items TO service_role;

alter table public.agenda_items enable row level security;

create policy "membros leem agenda" on public.agenda_items for select to authenticated using (public.is_member(org_id));
create policy "membros criam agenda" on public.agenda_items for insert to authenticated with check (public.is_member(org_id));
create policy "membros editam agenda" on public.agenda_items for update to authenticated using (public.is_member(org_id)) with check (public.is_member(org_id));
create policy "membros excluem agenda" on public.agenda_items for delete to authenticated using (public.is_member(org_id));

create trigger update_agenda_items_updated_at before update on public.agenda_items
for each row execute function public.update_updated_at_column();