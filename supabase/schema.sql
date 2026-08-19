-- Run this whole file in the Supabase SQL Editor.
-- Dashboard: https://supabase.com/dashboard/project/havgernmnajfpxagsyky/sql

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists questionnaire jsonb,
  add column if not exists money_profile jsonb,
  add column if not exists has_lifetime_access boolean not null default false,
  add column if not exists xp integer not null default 0,
  add column if not exists questions_asked integer not null default 0;

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can read own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

grant select, insert, update on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

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
