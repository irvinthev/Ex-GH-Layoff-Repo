create table if not exists public.admin_allowlist (
  email text primary key check (email = lower(trim(email))),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_allowlist enable row level security;

revoke all on table public.admin_allowlist from anon, authenticated;
grant all on table public.admin_allowlist to service_role;

insert into public.admin_allowlist (email, active)
values ('irvinthev@gmail.com', true)
on conflict (email) do update
set active = excluded.active,
    updated_at = now();

comment on table public.admin_allowlist is
'Server-only allowlist for placement-engine administrators. No client grants or RLS policies by design.';
