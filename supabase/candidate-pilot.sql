-- Candidate pilot. Private enrollments are added separately, never committed.
create table public.candidate_portal_access (
 candidate_id uuid primary key references public.network_members(id) on delete cascade,
 email text not null unique check(email=lower(trim(email))),
 active boolean not null default true,
 import_window timestamptz not null default now(),
 import_count integer not null default 0
);
create table public.candidate_saved_roles (
 id uuid primary key default gen_random_uuid(),
 candidate_id uuid not null references public.network_members(id) on delete cascade,
 job_id uuid references public.jobs(id) on delete cascade,
 source_url text not null, title text not null, company text not null default '',
 description text not null, location_text text not null default '', remote_type text not null default 'unknown',
 evidence_kind text not null check(evidence_kind in ('curated_summary','full_posting','pasted')),
 review_notes text not null default '', evaluation jsonb,
 status text not null default 'new' check(status in ('new','interested','pass','applied')),
 feedback_note text not null default '' check(length(feedback_note)<=1000),
 updated_at timestamptz not null default now(),
 unique(candidate_id,source_url)
);
create index candidate_saved_roles_job_idx on public.candidate_saved_roles(job_id);
alter table public.candidate_portal_access enable row level security;
alter table public.candidate_saved_roles enable row level security;
revoke all on public.candidate_portal_access,public.candidate_saved_roles from public,anon,authenticated;
grant select,insert,update,delete on public.candidate_portal_access,public.candidate_saved_roles to service_role;
comment on table public.candidate_portal_access is 'Server-only verified-email allowlist. No client access by design.';
comment on table public.candidate_saved_roles is 'Server-only candidate records. Edge handler scopes every query to verified membership.';
create function public.consume_candidate_import(p_candidate_id uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare allowed boolean;
begin
 update public.candidate_portal_access
 set import_count=case when import_window < now()-interval '1 minute' then 1 else import_count+1 end,
 import_window=case when import_window < now()-interval '1 minute' then now() else import_window end
 where candidate_id=p_candidate_id and active and (import_window < now()-interval '1 minute' or import_count<5)
 returning true into allowed;
 return coalesce(allowed,false);
end;
$$;
revoke all on function public.consume_candidate_import(uuid) from public,anon,authenticated;
grant execute on function public.consume_candidate_import(uuid) to service_role;
