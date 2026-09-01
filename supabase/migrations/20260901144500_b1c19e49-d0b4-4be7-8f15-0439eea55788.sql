alter table public.goals add column if not exists period_start date;

update public.goals
set period_start = created_at::date
where period_start is null;

alter table public.goals alter column period_start set default current_date;
alter table public.goals alter column period_start set not null;