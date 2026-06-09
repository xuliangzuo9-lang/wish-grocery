create table if not exists public.app_users (
  id text primary key,
  username text not null unique,
  display_name text not null,
  password_hash text not null,
  salt text not null,
  role text not null default 'user',
  status text not null default 'pending',
  note text not null default '',
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by text,
  rejected_at timestamptz,
  rejected_by text,
  last_login_at timestamptz
);

create table if not exists public.app_sessions (
  token text primary key,
  user_id text not null references public.app_users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.app_states (
  user_id text primary key references public.app_users(id) on delete cascade,
  state_json jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists app_users_created_at_idx on public.app_users (created_at desc);
create index if not exists app_sessions_user_id_idx on public.app_sessions (user_id);

alter table public.app_users enable row level security;
alter table public.app_sessions enable row level security;
alter table public.app_states enable row level security;

drop policy if exists "deny_anonymous_app_users" on public.app_users;
drop policy if exists "deny_anonymous_app_sessions" on public.app_sessions;
drop policy if exists "deny_anonymous_app_states" on public.app_states;

create policy "deny_anonymous_app_users"
on public.app_users
for all
to anon, authenticated
using (false)
with check (false);

create policy "deny_anonymous_app_sessions"
on public.app_sessions
for all
to anon, authenticated
using (false)
with check (false);

create policy "deny_anonymous_app_states"
on public.app_states
for all
to anon, authenticated
using (false)
with check (false);
