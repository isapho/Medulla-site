-- Medulla optional backend for Supabase (Postgres).
--
-- The site works fully without this. Run this file once in the Supabase
-- dashboard (SQL Editor → New query → paste → Run), then put the project URL
-- and the publishable (or legacy anon) key into js/config.js → backend.
--
-- Design:
--   * No accounts, no names, no emails. A sync row is keyed by the SHA-256 hash
--     of a random code that only the user's device knows.
--   * The browser can NOT read or write tables directly (RLS on, no policies,
--     privileges revoked). It can only call the six functions below.
--   * Counters are whitelisted names; clubs are short codes chosen by a teacher.
--
-- Safe to re-run: everything uses "if not exists" / "or replace".

-- ------------------------------------------------------------------ tables

create table if not exists public.sync_rows (
  key        text primary key check (key ~ '^[0-9a-f]{64}$'),
  payload    jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.counters (
  name  text primary key,
  value bigint not null default 0
);

create table if not exists public.club_counters (
  club  text not null check (club ~ '^[A-Z0-9]{4,12}$'),
  name  text not null,
  value bigint not null default 0,
  primary key (club, name)
);

insert into public.counters (name) values
  ('facts_read'), ('games_played'), ('breathing_sessions'), ('daily_challenges')
on conflict (name) do nothing;

-- Lock the tables: row level security with no policies means the anon and
-- authenticated roles see nothing. The functions below run as their owner.
alter table public.sync_rows     enable row level security;
alter table public.counters      enable row level security;
alter table public.club_counters enable row level security;
revoke all on public.sync_rows, public.counters, public.club_counters from anon, authenticated;

-- ---------------------------------------------------------------- sync

-- Save (insert or replace) the progress payload for one hashed code.
create or replace function public.sync_save(p_key text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_key is null or p_key !~ '^[0-9a-f]{64}$' then
    raise exception 'bad key' using errcode = '22023';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'bad payload' using errcode = '22023';
  end if;
  -- Progress is small (numbers and ids). Refuse anything unusually large.
  if octet_length(p_payload::text) > 100000 then
    raise exception 'payload too large' using errcode = '22023';
  end if;
  insert into sync_rows (key, payload, updated_at)
  values (p_key, p_payload, now())
  on conflict (key) do update set payload = excluded.payload, updated_at = now();
end;
$$;

-- Load the payload for one hashed code (null when there is none).
create or replace function public.sync_load(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select payload from sync_rows where key = p_key;
$$;

-- Delete the online copy for one hashed code.
create or replace function public.sync_delete(p_key text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from sync_rows where key = p_key;
$$;

-- ------------------------------------------------------------ counters

-- +1 on a whitelisted counter, and on the club total when a club code is given.
create or replace function public.counter_bump(p_name text, p_club text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_name not in ('facts_read', 'games_played', 'breathing_sessions', 'daily_challenges') then
    raise exception 'unknown counter' using errcode = '22023';
  end if;
  update counters set value = value + 1 where name = p_name;
  if p_club is not null then
    if p_club !~ '^[A-Z0-9]{4,12}$' then
      raise exception 'bad club code' using errcode = '22023';
    end if;
    insert into club_counters (club, name, value) values (p_club, p_name, 1)
    on conflict (club, name) do update set value = club_counters.value + 1;
  end if;
end;
$$;

-- All public counters as rows: [{ "name": "facts_read", "value": 12 }, ...]
create or replace function public.counters_get()
returns table (name text, value bigint)
language sql
stable
security definer
set search_path = public
as $$
  select c.name, c.value from counters c order by c.name;
$$;

-- One club's totals as an object: { "facts_read": 40, "games_played": 12 }
create or replace function public.club_totals(p_club text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(cc.name, cc.value), '{}'::jsonb)
  from club_counters cc
  where cc.club = p_club;
$$;

-- --------------------------------------------------------- permissions

-- Functions are executable by PUBLIC by default; narrow that to the API roles.
revoke execute on function
  public.sync_save(text, jsonb), public.sync_load(text), public.sync_delete(text),
  public.counter_bump(text, text), public.counters_get(), public.club_totals(text)
from public;

grant execute on function
  public.sync_save(text, jsonb), public.sync_load(text), public.sync_delete(text),
  public.counter_bump(text, text), public.counters_get(), public.club_totals(text)
to anon, authenticated;

-- --------------------------------------------------------- housekeeping

-- Optional: forget sync rows nobody has touched for a year. Run by hand, or
-- schedule it with the pg_cron extension (Database → Extensions → pg_cron):
--   select cron.schedule('medulla-forget-old-sync', '0 3 * * 0',
--     $$delete from public.sync_rows where updated_at < now() - interval '365 days'$$);
