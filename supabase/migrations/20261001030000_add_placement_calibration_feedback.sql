create table if not exists public.placement_calibration_feedback (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.network_members(id) on delete cascade,
  company text not null,
  job_title text not null,
  job_url text,
  engine_version text,
  predicted_score smallint check (predicted_score is null or (predicted_score >= 0 and predicted_score <= 100)),
  fit_band text check (fit_band is null or fit_band in ('Strong','Possible','Exploratory')),
  score_breakdown jsonb not null default '{}'::jsonb,
  recommendation_status text not null default 'recommended'
    check (recommendation_status in ('recommended','viewed','interested','applied','recruiter_screen','hiring_manager_interview','final_round','offer','accepted','pass','rejected','already_applied','already_seen','location_mismatch','wrong_level','wrong_role','not_interested','pending_feedback')),
  outcome_strength smallint check (outcome_strength is null or (outcome_strength >= 0 and outcome_strength <= 100)),
  candidate_feedback text,
  calibration_label text check (calibration_label is null or calibration_label in ('strong_positive','positive','neutral','negative','pending')),
  observed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on table public.placement_calibration_feedback from anon, authenticated;
grant select, insert, update on table public.placement_calibration_feedback to service_role;

create index if not exists placement_calibration_feedback_candidate_idx
  on public.placement_calibration_feedback (candidate_id, observed_at desc);

create index if not exists placement_calibration_feedback_score_idx
  on public.placement_calibration_feedback (predicted_score, calibration_label);

create unique index if not exists placement_calibration_feedback_candidate_job_uidx
  on public.placement_calibration_feedback (candidate_id, lower(company), lower(job_title));

comment on table public.placement_calibration_feedback is
  'Observed recommendation outcomes used to calibrate Placement Intelligence. Outcomes never directly alter candidate fit scores.';

insert into public.placement_calibration_feedback (
  candidate_id, company, job_title, engine_version, predicted_score, fit_band,
  recommendation_status, outcome_strength, candidate_feedback, calibration_label, observed_at, metadata
)
select id, 'Early Warning Services', 'Product Marketing Director - Paze', 'v6-replay', 80, 'Strong',
       'hiring_manager_interview', 70,
       'Candidate already had a hiring interview scheduled for this role on the day it was recommended.',
       'strong_positive', '2026-09-30T12:00:00-04:00',
       '{"source":"direct_candidate_feedback","validation_type":"behavioral"}'::jsonb
from public.network_members
where first_name='Jill' and last_name='Weinstein'
on conflict (candidate_id, lower(company), lower(job_title)) do nothing;

insert into public.placement_calibration_feedback (
  candidate_id, company, job_title, engine_version, predicted_score, fit_band,
  recommendation_status, outcome_strength, candidate_feedback, calibration_label, observed_at, metadata
)
select id, 'ADP', 'Director Product Marketing - Lyric', 'v6-replay', 80, 'Strong',
       'applied', 60,
       'Candidate had viewed the role as a long shot, then reconsidered and applied after the recommendation.',
       'strong_positive', '2026-09-30T12:00:00-04:00',
       '{"source":"direct_candidate_feedback","validation_type":"behavioral","self_screening_override":true}'::jsonb
from public.network_members
where first_name='Jill' and last_name='Weinstein'
on conflict (candidate_id, lower(company), lower(job_title)) do nothing;

insert into public.placement_calibration_feedback (
  candidate_id, company, job_title, engine_version, predicted_score, fit_band,
  recommendation_status, outcome_strength, candidate_feedback, calibration_label, observed_at, metadata
)
select id, 'CTDI', 'Sr. Operations Manager', 'v6-replay', 70, 'Possible',
       'interested', 50,
       'Candidate said the recommended roles were 100% matches.',
       'strong_positive', '2026-09-30T12:00:00-04:00',
       '{"source":"direct_candidate_feedback","validation_type":"candidate_fit_feedback"}'::jsonb
from public.network_members
where first_name='Kelsey' and last_name='Peretti'
on conflict (candidate_id, lower(company), lower(job_title)) do nothing;

insert into public.placement_calibration_feedback (
  candidate_id, company, job_title, engine_version, predicted_score, fit_band,
  recommendation_status, outcome_strength, candidate_feedback, calibration_label, observed_at, metadata
)
select id, 'Bloom Energy', 'Sr. Operations Manager', 'v6-replay', 58, 'Possible',
       'interested', 50,
       'Candidate said the recommended roles were 100% matches.',
       'strong_positive', '2026-09-30T12:00:00-04:00',
       '{"source":"direct_candidate_feedback","validation_type":"candidate_fit_feedback"}'::jsonb
from public.network_members
where first_name='Kelsey' and last_name='Peretti'
on conflict (candidate_id, lower(company), lower(job_title)) do nothing;

insert into public.placement_calibration_feedback (
  candidate_id, company, job_title, engine_version, predicted_score, fit_band,
  recommendation_status, outcome_strength, candidate_feedback, calibration_label, observed_at, metadata
)
select id, 'Finix', 'Customer Delivery Manager', 'v6-replay', null, null,
       'applied', 60,
       'Candidate applied to the recommended role.',
       'strong_positive', '2026-09-30T12:00:00-04:00',
       '{"source":"direct_candidate_feedback","validation_type":"behavioral","score_replay_pending":true}'::jsonb
from public.network_members
where first_name='Elena' and last_name='Moilan'
on conflict (candidate_id, lower(company), lower(job_title)) do nothing;

insert into public.placement_calibration_feedback (
  candidate_id, company, job_title, engine_version, predicted_score, fit_band,
  recommendation_status, outcome_strength, candidate_feedback, calibration_label, observed_at, metadata
)
select id, 'Handshake', 'Enterprise Customer Success Manager', 'v6-replay', null, null,
       'applied', 60,
       'Candidate applied to the recommended role.',
       'strong_positive', '2026-09-30T12:00:00-04:00',
       '{"source":"direct_candidate_feedback","validation_type":"behavioral","score_replay_pending":true}'::jsonb
from public.network_members
where first_name='Elena' and last_name='Moilan'
on conflict (candidate_id, lower(company), lower(job_title)) do nothing;

insert into public.placement_calibration_feedback (
  candidate_id, company, job_title, engine_version, predicted_score, fit_band,
  recommendation_status, outcome_strength, candidate_feedback, calibration_label, observed_at, metadata
)
select id, 'Meadow', 'Senior Product Manager', 'v6-replay', 69, 'Possible',
       'pending_feedback', null,
       'Recommendation sent; candidate feedback has not yet been received.',
       'pending', null,
       '{"source":"recommendation_record","validation_type":"pending"}'::jsonb
from public.network_members
where first_name='Paul' and last_name='de Lucena'
on conflict (candidate_id, lower(company), lower(job_title)) do nothing;

insert into public.placement_calibration_feedback (
  candidate_id, company, job_title, engine_version, predicted_score, fit_band,
  recommendation_status, outcome_strength, candidate_feedback, calibration_label, observed_at, metadata
)
select id, 'Suno', 'Staff Technical Program Manager', 'v6-replay', 74, 'Possible',
       'pending_feedback', null,
       'Recommendation sent; candidate feedback has not yet been received.',
       'pending', null,
       '{"source":"recommendation_record","validation_type":"pending"}'::jsonb
from public.network_members
where first_name='Paul' and last_name='de Lucena'
on conflict (candidate_id, lower(company), lower(job_title)) do nothing;
