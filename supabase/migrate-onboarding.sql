-- Paste this in the SQL Editor and click Run.
-- https://supabase.com/dashboard/project/havgernmnajfpxagsyky/sql

alter table public.profiles
  add column if not exists questionnaire jsonb,
  add column if not exists money_profile jsonb,
  add column if not exists has_lifetime_access boolean not null default false,
  add column if not exists xp integer not null default 0;

create table if not exists public.scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  prompt text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.scenarios enable row level security;

drop policy if exists "Users can read own scenarios" on public.scenarios;
drop policy if exists "Users can insert own scenarios" on public.scenarios;
drop policy if exists "Users can delete own scenarios" on public.scenarios;

create policy "Users can read own scenarios"
  on public.scenarios for select using (auth.uid() = user_id);

create policy "Users can insert own scenarios"
  on public.scenarios for insert with check (auth.uid() = user_id);

create policy "Users can delete own scenarios"
  on public.scenarios for delete using (auth.uid() = user_id);

grant select, insert, delete on public.scenarios to authenticated;
