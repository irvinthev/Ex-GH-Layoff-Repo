# Placement Intelligence MVP

This MVP provides a private, role-first matching workflow for the TalentBot HQ.

## What it does

1. An administrator signs in through the private beta access flow.
2. The administrator provides a public job URL, a pasted description, or both. Public pages are imported when readable; the paste workflow remains available when a job board blocks automated access.
3. The `evaluate-job` Edge Function validates the beta session (or supported legacy JWT path) and checks the server-only admin allowlist.
4. The candidate population is built from public `people.json` directory records, then merged with optional Supabase enrichment using LinkedIn-first identity resolution and conservative name fallback.
5. One canonical merged candidate profile drives both qualification scoring and evidence-depth reporting.
6. The page displays the score breakdown, evidence provenance, and gaps requiring review.
   - Results can be sorted and filtered by fit.
   - Current fit bands are Strong ≥ 75, Possible ≥ 55, otherwise Exploratory.

Evaluation history is saved privately for administrators. Candidate recommendations and observed outcomes can also be recorded in `placement_calibration_feedback` for calibration. Calibration outcomes are analytics labels only: they never add candidate-specific bonuses to the fit score.

## Scoring model

Primary qualification score is normalized from four merit components:

| Signal | Max points |
| --- | ---: |
| Role family | 30 |
| Title / specialty | 15 |
| Skills / recognized JD capabilities | 20 |
| Domain | 15 |

Seniority and location/work model are retained as **validation signals** (10 points each in the breakdown UI) but are excluded from the normalized capability score.

Current controls:

- Held-title specialty is scored independently. A matching title cannot also create role-family credit by itself.
- Role-family credit is independent from held-title scoring. Higher role-family credit requires exact role evidence or corroboration across multiple distinct core JD capabilities; generic transferable concepts alone cannot establish the role family. Related function alignment remains a lower-strength signal.
- Skills are scored from distinct recognized JD capability units. Repeating the same capability across directory text, public skills, resume enrichment, or structured enrichment cannot multiply points.
- Directory `Description` is first-class candidate evidence. If it resolves a JD capability, that match is eligible for scoring and provenance reporting.
- Preferred/optional JD sections do not supply core qualification points.
- Domain points require explicit job-description relevance; broad semantic context alone is insufficient.
- Candidate intent, target titles, Spotlight status, profile depth, and enrichment breadth do not add qualification points.
- Missing enrichment is not negative evidence.

### Evidence layers

The same canonical candidate used by `scoreCandidate()` is also used for evidence-depth reporting:

- **L1** — structured public profile facts: held title, team, function, location.
- **L2** — public candidate narrative and public skills from the directory.
- **L3** — approved enriched qualification evidence such as structured enriched skills/domains and resume-derived evidence.

Profile depth is metadata, not merit. A Directory Profile can outrank an Enriched or Spotlight Profile.

Matched capabilities also include provenance identifying the supporting source (for example directory description, public skill, enriched skill, or enriched evidence).

Scores are deterministic comparative signals, not qualification percentages or hiring probabilities. Human review remains required.

## Deployment

- Static page: `placement.html`, `placement.css`, and `placement.js`
- Function: `supabase/functions/evaluate-job/index.ts`
- Cache helpers: `supabase/functions/evaluate-job/candidate-cache.ts` and `supabase/functions/evaluate-job/types.ts`
- Function configuration: `verify_jwt` is disabled because the function performs custom beta-session authorization in the request body/header path; do not remove that application-layer authorization.
- Candidate baseline comes from public `people.json`. Supabase `placement_candidate_cache` is an optional enrichment overlay, not the authoritative roster.
- The merged canonical candidate cache has a 1-hour in-memory TTL per Edge Function isolate.
- Evaluation timing is persisted to `evaluation_metrics` for cache/query monitoring.
- Browser key: the Supabase publishable key in `placement.js` is designed to be public. Never add a service-role key to browser code.
- URL imports accept public HTTPS pages, follow only validated redirects, stop after 10 seconds, and limit downloaded HTML to 1 MB. Imported descriptions are not saved by this MVP.

## Supabase Auth redirect

Add the deployed placement page to **Authentication → URL Configuration → Redirect URLs**:

`https://irvinthev.github.io/Ex-GH-Layoff-Repo/placement.html`

For local testing, also add `http://localhost:8000/placement.html` and serve the repository with a static HTTP server.


## Calibration feedback

Observed recommendation outcomes are stored separately from candidate evidence in `placement_calibration_feedback`.

Supported lifecycle states include:

`recommended → viewed → interested → applied → recruiter_screen → hiring_manager_interview → final_round → offer → accepted`

Negative calibration states include `pass`, `rejected`, `location_mismatch`, `wrong_level`, `wrong_role`, and `not_interested`.

Outcome strength is an analysis field, not a scoring input:

| Outcome | Strength |
| --- | ---: |
| Viewed | 20 |
| Interested | 40 |
| Applied | 60 |
| Recruiter screen | 65 |
| Hiring manager interview | 70 |
| Final round | 80 |
| Offer | 90 |
| Accepted | 100 |

The initial calibration dataset contains validated feedback from Jill Weinstein, Kelsey Peretti, and Elena Moilan. Paul de Lucena's two recommendations are retained as pending feedback and must not be counted as validated outcomes.

Regression tests cover canonical directory evidence, enrichment invariance, title/role-family separation, provenance, higher-education/EdTech equivalence, and transferable logistics/operations evidence.
