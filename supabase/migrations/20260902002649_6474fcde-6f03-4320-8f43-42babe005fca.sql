alter table public.cards add column if not exists priority text not null default 'normal'
  check (priority in ('baixa','normal','alta','urgente'));