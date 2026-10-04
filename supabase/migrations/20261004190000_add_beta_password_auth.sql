-- Beta shared-password authentication support.
-- The plaintext beta password is never stored here.
-- Runtime configuration stores only a salted PBKDF2 hash.

create table if not exists public.beta_access_config (
  id smallint primary key check (id = 1),
  password_salt text not null,
  password_hash text not null,
  password_iterations integer not null check (password_iterations >= 100000),
  updated_at timestamptz not null default now()
);

alter table public.beta_access_config enable row level security;

create table if not exists public.beta_sessions (
  token_hash text primary key,
  email text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.beta_sessions enable row level security;
create index if not exists beta_sessions_email_idx on public.beta_sessions(email);
create index if not exists beta_sessions_expires_at_idx on public.beta_sessions(expires_at);

create table if not exists public.beta_auth_attempts (
  id bigint generated always as identity primary key,
  email text not null,
  source_ip text,
  success boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.beta_auth_attempts enable row level security;
create index if not exists beta_auth_attempts_email_created_idx
  on public.beta_auth_attempts(email, created_at desc);
create index if not exists beta_auth_attempts_ip_created_idx
  on public.beta_auth_attempts(source_ip, created_at desc);

alter table public.job_evaluation_runs
  add column if not exists actor_email text;

create index if not exists job_evaluation_runs_actor_email_created_idx
  on public.job_evaluation_runs(actor_email, created_at desc);

grant select on table public.beta_access_config to service_role;
grant select, insert on table public.beta_auth_attempts to service_role;
grant select, insert, delete on table public.beta_sessions to service_role;
grant usage, select on sequence public.beta_auth_attempts_id_seq to service_role;
