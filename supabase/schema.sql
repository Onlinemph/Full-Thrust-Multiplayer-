-- Full Thrust: Project Continuum — remote play through Supabase.
--
-- Run this once in the SQL editor of a Supabase project (or `supabase db push`
-- from a linked CLI), then build the app with
--
--   VITE_SUPABASE_URL=https://<ref>.supabase.co
--   VITE_SUPABASE_ANON_KEY=<the project's anon key>
--
-- The table holds one row per match: the code, and the battle as the same JSON
-- a battle file holds — the setup and the list of actions. The server knows
-- nothing about the rules; the host's console stays the ordering authority
-- and rewrites the row as the battle goes.
--
-- The match code is the only secret. Row Level Security is on and no policy
-- grants the anon role anything, so the anon key cannot list or read the
-- table directly; the three functions below run as the definer and are the
-- whole of what a browser can do, each keyed on a code it has to know.
-- Realtime traffic between the two consoles is a broadcast channel named
-- after the code and touches no table at all.

create table if not exists public.matches (
  code        text primary key,
  saved       jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.matches enable row level security;

-- Host: open a match under a fresh code. Fails if the code is taken, which
-- the client answers by minting another.
create or replace function public.create_match(p_code text, p_saved jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.matches (code, saved) values (upper(p_code), p_saved);
$$;

-- Either console: the battle as last saved, or null for a code nobody holds.
create or replace function public.fetch_match(p_code text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select saved from public.matches where code = upper(p_code);
$$;

-- Host: the battle as it now stands.
create or replace function public.save_match(p_code text, p_saved jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  update public.matches
     set saved = p_saved, updated_at = now()
   where code = upper(p_code);
$$;

revoke all on public.matches from anon, authenticated;
grant execute on function public.create_match(text, jsonb) to anon, authenticated;
grant execute on function public.fetch_match(text) to anon, authenticated;
grant execute on function public.save_match(text, jsonb) to anon, authenticated;

-- Housekeeping, optional: matches nobody has touched for a month.
--   delete from public.matches where updated_at < now() - interval '30 days';
