alter table public.connections     add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table public.payment_accounts add column if not exists stripe_connection_id uuid references public.connections(id) on delete set null;

alter table public.payment_accounts add column if not exists balance_available numeric(14,2) not null default 0;
alter table public.payment_accounts add column if not exists balance_pending   numeric(14,2) not null default 0;
alter table public.payment_accounts add column if not exists balance_reserved  numeric(14,2) not null default 0;
alter table public.payment_accounts add column if not exists gross_volume      numeric(14,2) not null default 0;
alter table public.payment_accounts add column if not exists fees_total        numeric(14,2) not null default 0;
alter table public.payment_accounts add column if not exists refunds_total     numeric(14,2) not null default 0;
alter table public.payment_accounts add column if not exists payouts_total     numeric(14,2) not null default 0;
alter table public.payment_accounts add column if not exists last_synced_at    timestamptz;
alter table public.payment_accounts add column if not exists sync_error        text;

create extension if not exists supabase_vault with schema vault;