create table public.payment_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  provider text not null default '',
  fee_percent numeric(6,3) not null default 0,
  payout_days int not null default 0,
  color text not null default '#64748b',
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  label text not null default '',
  secret_ref text,
  key_mask text,
  status text not null default 'desconectado' check (status in ('desconectado','conectado','erro')),
  last_sync_at timestamptz,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid references public.payment_accounts(id) on delete set null,
  date date not null default current_date,
  description text not null default '',
  gross numeric(14,2) not null default 0,
  fee_percent numeric(6,3) not null default 0,
  paid_out boolean not null default false,
  external_id text,
  finance_entry_id uuid references public.finance_entries(id) on delete set null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index payment_receipts_org_external_idx
  on public.payment_receipts (org_id, account_id, external_id)
  where external_id is not null;

create index on public.payment_accounts (org_id);
create index on public.connections (org_id);
create index on public.payment_receipts (org_id, date desc);

create or replace function public.is_admin_or_owner(target_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = target_org and m.user_id = auth.uid() and m.role in ('dono','admin')
  );
$$;

alter table public.payment_accounts enable row level security;
alter table public.connections      enable row level security;
alter table public.payment_receipts enable row level security;

create policy "membros leem contas de recebimento" on public.payment_accounts for select to authenticated using (public.is_member(org_id));
create policy "membros criam contas de recebimento" on public.payment_accounts for insert to authenticated with check (public.is_member(org_id));
create policy "membros editam contas de recebimento" on public.payment_accounts for update to authenticated using (public.is_member(org_id)) with check (public.is_member(org_id));
create policy "membros excluem contas de recebimento" on public.payment_accounts for delete to authenticated using (public.is_member(org_id));

create policy "membros leem conexoes" on public.connections for select to authenticated using (public.is_member(org_id));
create policy "admin cria conexao" on public.connections for insert to authenticated with check (public.is_admin_or_owner(org_id));
create policy "admin edita conexao" on public.connections for update to authenticated using (public.is_admin_or_owner(org_id)) with check (public.is_admin_or_owner(org_id));
create policy "admin exclui conexao" on public.connections for delete to authenticated using (public.is_admin_or_owner(org_id));

create policy "membros leem recebimentos" on public.payment_receipts for select to authenticated using (public.is_member(org_id));
create policy "membros criam recebimentos" on public.payment_receipts for insert to authenticated with check (public.is_member(org_id));
create policy "membros editam recebimentos" on public.payment_receipts for update to authenticated using (public.is_member(org_id)) with check (public.is_member(org_id));
create policy "membros excluem recebimentos" on public.payment_receipts for delete to authenticated using (public.is_member(org_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_accounts TO authenticated;
GRANT ALL ON public.payment_accounts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.connections TO authenticated;
GRANT ALL ON public.connections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_receipts TO authenticated;
GRANT ALL ON public.payment_receipts TO service_role;

CREATE TRIGGER update_payment_accounts_updated_at BEFORE UPDATE ON public.payment_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_connections_updated_at BEFORE UPDATE ON public.connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payment_receipts_updated_at BEFORE UPDATE ON public.payment_receipts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();