create extension if not exists pg_cron;

create table if not exists public.evaluation_metrics (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null,
  title text not null,
  source_url text,
  source_mode text not null,
  role_slug text,
  cache_status text not null check (cache_status in ('hit', 'refresh')),
  cache_load_ms integer not null default 0 check (cache_load_ms >= 0),
  database_query_ms integer not null default 0 check (database_query_ms >= 0),
  scoring_ms integer not null default 0 check (scoring_ms >= 0),
  total_duration_ms integer not null default 0 check (total_duration_ms >= 0),
  candidate_count integer not null default 0 check (candidate_count >= 0),
  cached_candidate_count integer not null default 0 check (cached_candidate_count >= 0),
  cache_loaded_at timestamptz,
  created_at timestamptz not null default now()
);

revoke all on table public.evaluation_metrics from anon, authenticated;
grant insert, select on table public.evaluation_metrics to service_role;
grant usage, select on sequence public.evaluation_metrics_id_seq to service_role;

create index if not exists evaluation_metrics_created_at_idx
  on public.evaluation_metrics (created_at desc);

create index if not exists evaluation_metrics_actor_created_at_idx
  on public.evaluation_metrics (actor_user_id, created_at desc);

drop materialized view if exists public.placement_candidate_cache;

create materialized view public.placement_candidate_cache as
select
  m.id as candidate_id,
  m.first_name,
  m.last_name,
  m.former_job_title,
  m.former_team,
  m.function_name,
  m.location_text,
  m.linkedin_url,
  m.public_description,
  coalesce(m.public_skills, '{}'::text[]) as public_skills,
  f.primary_role_slug,
  f.seniority,
  coalesce(f.skills, '{}'::text[]) as skills,
  coalesce(f.domains, '{}'::text[]) as domains,
  coalesce(f.evidence, '{}'::jsonb) as evidence,
  coalesce(rp.role_preferences, '[]'::jsonb) as role_preferences,
  coalesce(
    cp.candidate_preferences,
    jsonb_build_object(
      'target_titles', '[]'::jsonb,
      'preferred_locations', '[]'::jsonb,
      'remote_preference', to_jsonb(null::text)
    )
  ) as candidate_preferences
from public.network_members m
left join public.candidate_features f
  on f.candidate_id = m.id
left join lateral (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'role_slug', preference.role_slug,
        'preference', preference.preference,
        'priority', preference.priority
      )
      order by preference.priority nulls last, preference.role_slug
    ),
    '[]'::jsonb
  ) as role_preferences
  from public.candidate_role_preferences preference
  where preference.candidate_id = m.id
) rp on true
left join lateral (
  select jsonb_build_object(
    'target_titles', coalesce(to_jsonb(preference.target_titles), '[]'::jsonb),
    'preferred_locations', coalesce(to_jsonb(preference.preferred_locations), '[]'::jsonb),
    'remote_preference', to_jsonb(preference.remote_preference)
  ) as candidate_preferences
  from public.candidate_preferences preference
  where preference.candidate_id = m.id
  limit 1
) cp on true
where m.matching_opt_in = true
  and m.open_to_work = true;

create unique index placement_candidate_cache_candidate_id_idx
  on public.placement_candidate_cache (candidate_id);

grant select on table public.placement_candidate_cache to service_role;

do $$
declare
  scheduled_job record;
begin
  for scheduled_job in
    select jobid
    from cron.job
    where jobname = 'refresh-placement-candidate-cache'
  loop
    perform cron.unschedule(scheduled_job.jobid);
  end loop;
end;
$$;

select cron.schedule(
  'refresh-placement-candidate-cache',
  '0 2 * * *',
  $$refresh materialized view concurrently public.placement_candidate_cache;$$
);
