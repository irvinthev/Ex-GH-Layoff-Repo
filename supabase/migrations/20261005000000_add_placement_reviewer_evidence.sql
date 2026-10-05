-- Reviewer-validated candidate evidence. Append-only audit history: a newer
-- decision deactivates (active = false) the prior row and never overwrites it.
-- candidate_id is text because directory-only candidates use non-UUID ids.
create table if not exists public.placement_reviewer_evidence (
  id uuid primary key default gen_random_uuid(),
  candidate_id text not null,
  evidence_type text not null check (evidence_type in ('capability','title')),
  value text not null check (length(trim(value)) > 0),
  status text not null check (status in ('validated','rejected')),
  source_type text not null check (source_type in ('linkedin','resume','portfolio','direct_knowledge','other')),
  source_url text,
  note text,
  reviewed_by text not null,
  reviewed_at timestamptz not null default now(),
  active boolean not null default true
);

alter table public.placement_reviewer_evidence enable row level security;

revoke all on table public.placement_reviewer_evidence from anon, authenticated;
grant select, insert, update on table public.placement_reviewer_evidence to service_role;

create index if not exists placement_reviewer_evidence_candidate_idx
  on public.placement_reviewer_evidence (candidate_id, active, reviewed_at desc);

create unique index if not exists placement_reviewer_evidence_active_uidx
  on public.placement_reviewer_evidence (candidate_id, evidence_type, lower(value))
  where active;

comment on table public.placement_reviewer_evidence is
  'Append-only reviewer validation/rejection of candidate capabilities and titles. Separate from calibration feedback; validated capabilities are consumed like other candidate evidence and never add bonus points.';
