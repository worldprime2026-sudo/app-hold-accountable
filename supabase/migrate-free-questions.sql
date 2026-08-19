-- Run this in the SQL Editor so free questions can be counted.
-- https://supabase.com/dashboard/project/havgernmnajfpxagsyky/sql

alter table public.profiles
  add column if not exists questions_asked integer not null default 0;
