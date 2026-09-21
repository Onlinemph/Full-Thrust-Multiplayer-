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

-- ---------------------------------------------------------------------------
-- The community shelf: ship designs players have published.
--
-- One row per published design, holding the JSON the shipyard wrote. The
-- server knows nothing about what a design is; every browser that reads the
-- shelf reprices and validates what it gets. Two functions, publish and list,
-- and no delete: the anon key is meant to ship in a browser, and taking a
-- design down is done here in the SQL editor —
--   delete from public.designs where id = '<id>';

create table if not exists public.designs (
  id          uuid primary key default gen_random_uuid(),
  design      jsonb not null,
  name        text not null,
  author      text not null default '',
  mass        integer not null default 0,
  points      integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.designs enable row level security;

-- Anyone: put a design on the shelf. Refuses anything too big to be a design.
create or replace function public.publish_design(p_design jsonb, p_author text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if pg_column_size(p_design) > 131072 then
    raise exception 'design too large';
  end if;
  insert into public.designs (design, name, author, mass, points)
  values (
    p_design,
    left(coalesce(p_design->>'name', 'Unnamed design'), 60),
    left(coalesce(p_author, ''), 40),
    coalesce(nullif(p_design->>'mass', '')::numeric::integer, 0),
    coalesce(nullif(p_design->>'points', '')::numeric::integer, 0)
  )
  returning id into new_id;
  return new_id;
end;
$$;

-- Anyone: the shelf, newest first.
create or replace function public.list_designs(p_limit integer default 200)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(to_jsonb(d) order by d.created_at desc), '[]'::jsonb)
    from (
      select id, name, author, mass, points, created_at, design
        from public.designs
       order by created_at desc
       limit least(greatest(coalesce(p_limit, 200), 1), 500)
    ) d;
$$;

revoke all on public.designs from anon, authenticated;
grant execute on function public.publish_design(jsonb, text) to anon, authenticated;
grant execute on function public.list_designs(integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Rules presets: the gear a table allows and the options it plays under
-- (src/data/rulesPreset.ts), published to a shelf the way designs are.
-- ---------------------------------------------------------------------------

create table if not exists public.rules_presets (
  id          uuid primary key default gen_random_uuid(),
  preset      jsonb not null,
  name        text not null,
  author      text not null default '',
  created_at  timestamptz not null default now()
);

alter table public.rules_presets enable row level security;

-- Anyone: put a preset on the shelf. Refuses anything too big to be one.
create or replace function public.publish_preset(p_preset jsonb, p_author text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if pg_column_size(p_preset) > 32768 then
    raise exception 'preset too large';
  end if;
  insert into public.rules_presets (preset, name, author)
  values (
    p_preset,
    left(coalesce(p_preset->>'name', 'Unnamed preset'), 80),
    left(coalesce(p_author, ''), 40)
  )
  returning id into new_id;
  return new_id;
end;
$$;

-- Anyone: the shelf, newest first.
create or replace function public.list_presets(p_limit integer default 200)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at desc), '[]'::jsonb)
    from (
      select id, name, author, created_at, preset
        from public.rules_presets
       order by created_at desc
       limit least(greatest(coalesce(p_limit, 200), 1), 500)
    ) p;
$$;

revoke all on public.rules_presets from anon, authenticated;
grant execute on function public.publish_preset(jsonb, text) to anon, authenticated;
grant execute on function public.list_presets(integer) to anon, authenticated;
