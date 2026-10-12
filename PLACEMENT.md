# Placement Intelligence MVP

This MVP provides a private, role-first matching workflow for the Talent Network HQ.

## What it does

1. An administrator signs in through the private beta access flow.
2. The administrator provides a public job URL, a pasted description, or both. Public pages are imported when readable; the paste workflow remains available when a job board blocks automated access.
3. The `evaluate-job` Edge Function validates the beta session (or supported legacy JWT path) and checks the server-only admin allowlist.
4. The candidate population is built from public `people.json` directory records, then merged with optional Supabase enrichment using LinkedIn-first identity resolution and conservative name fallback.
5. One canonical merged candidate profile drives both qualification scoring and evidence-sufficiency reporting.
6. The page displays qualification fit, evidence sufficiency, and compatibility as separate axes, alongside evidence provenance and items requiring validation.
   - Results can be sorted and filtered by fit.
   - Current fit bands are Strong ≥ 75, Possible ≥ 55, otherwise Exploratory.

Evaluation history is saved privately for administrators. Candidate recommendations and observed outcomes can also be recorded in `placement_calibration_feedback` for calibration. Calibration outcomes are analytics labels only: they never add candidate-specific bonuses to the fit score.

## Scoring model

Primary qualification score is normalized from four merit components:

| Signal | Max points |
| --- | ---: |
| Role family | 30 |
| Title / specialty | 15 |
| Capabilities / recognized JD requirements | 20 |
| Domain | 15 |

Seniority and the legacy location calculation remain **validation signals** and are excluded from the normalized qualification score. Recruiter-facing work arrangement, location, relocation, and experience are reported separately through the compatibility layer.

Current controls:

- Held-title specialty is scored independently. A matching title cannot also create role-family credit by itself.
- Role-family credit is independent from held-title scoring. Higher role-family credit requires exact role evidence or corroboration across multiple distinct core JD capabilities; generic transferable concepts alone cannot establish the role family. Related function alignment remains a lower-strength signal.
- Skills are scored from distinct recognized JD capability units. Repeating the same capability across directory text, public skills, resume enrichment, or structured enrichment cannot multiply points.
- Directory `Description` is first-class candidate evidence. If it resolves a JD capability, that match is eligible for scoring and provenance reporting.
- Preferred/optional JD sections do not supply core qualification points.
- Domain points require explicit job-description relevance; broad semantic context alone is insufficient.
- Candidate intent, target titles, Spotlight status, profile depth, and enrichment breadth do not add qualification points.
- Missing enrichment is not negative evidence.
- Generic skill labels cannot establish role-family relevance; role evidence is drawn from candidate narrative, structured team information, resume-derived experience, or reviewer validation.
- Generated or inferred fields are not qualification sources. Resume summaries are accepted only within the explicit `evidence.resume` source; ambiguous root-level `evidence.summary` text is not scored.

### Phase 1 evidence and rankability behavior

**Before:** A populated L1/L2/L3 profile could be described as High evidence sufficiency even when it contained no capability relevant to the job. Role-family credit could also be increased by an exact role phrase appearing only as a skill label, and unqualified summary text had no explicit provenance boundary. Results were displayed in one ranked list.

**Now:** Qualification score, evidence sufficiency, compatibility, and rankability remain separate:

- Existing qualification weights (30 / 15 / 20 / 15) and fit thresholds (Strong ≥ 75, Possible ≥ 55) are unchanged. Seniority and compatibility remain excluded from the qualification score.
- Skill evidence continues to resolve distinct core JD capability units once. A skill label alone cannot establish a candidate's role family; generated/inferred content and ambiguous unlabelled root summaries cannot resolve capabilities or role families.
- Evidence traces retain the source for every matched capability: candidate-provided directory description/skills, enriched skills/evidence, resume-derived evidence, or reviewer-validated evidence. Explicit generated/inferred sources are ignored.
- L1/L2/L3 still report which profile layers are present. Sufficiency is now job-specific: **Limited** when no distinct core capability is evidenced; **Moderate** with at least one; **High** only with at least two plus L1, L2, and L3. Irrelevant enrichment therefore cannot create High sufficiency.
- **Ranked Matches** require role-family support (at least 24/30), at least one distinct evidenced core capability, and direct evidence for an explicitly required technical capability when the job has one. All other eligible candidates appear under **Needs Validation**; this category does not imply the candidate lacks a capability.
- Location, work-model, relocation, and experience compatibility remain visible on either category and do not change qualification score or rankability. Existing reviewer actions continue to support capability/title validation.
- All eligible candidates remain in the result payload. The page initially shows up to five candidates per category and provides a control to display all candidates.

These rankability and sufficiency rules are conservative presentation/review signals, not new score points or hiring thresholds. Their capability-count assumptions are uncalibrated and should be reviewed against outcomes before any score or fit-band changes.

### Evidence sufficiency

The same canonical candidate used by `scoreCandidate()` is also used to report how much evidence is available:

- **L1** — structured public profile facts: held title, team, function, location.
- **L2** — public candidate narrative and public skills from the directory.
- **L3** — approved enriched qualification evidence such as structured enriched skills/domains and resume-derived evidence.

Evidence sufficiency is reported as **Limited**, **Moderate**, or **High**, using distinct job-relevant core capabilities as described above. It is a separate axis from qualification fit and compatibility.

A sparse directory profile is not downgraded merely because it contains less evidence. Missing evidence means a capability is **not established from the available profile**, not that the candidate lacks it. Evidence sufficiency never changes qualification score, fit band, or rank.

Profile depth is metadata, not merit. A Directory Profile can outrank an Enriched or Spotlight Profile.

Matched capabilities include provenance identifying the supporting source (for example candidate-provided directory description/skill, enriched skill, resume-derived evidence, or reviewer-validated evidence). Generated and inferred content cannot establish a qualification.

Scores are deterministic comparative signals, not qualification percentages or hiring probabilities. Human review remains required.

### Compatibility

Compatibility is evaluated separately from qualification and never changes qualification score, fit band, core coverage, or ranking.

Current compatibility signals are:

- **Work arrangement** — compares the job's remote / hybrid / onsite model with the candidate's recorded work preferences.
- **Location** — checks clear local alignment; ambiguous geography returns Unknown rather than inventing a mismatch.
- **Relocation** — uses the candidate's recorded Yes / No / Conditional relocation preference when geography differs.
- **Experience** — compares a structured candidate experience band with an explicit years-of-experience requirement detected in the JD. Potential under-level or over-level cases are review conditions, not automatic disqualification.

Statuses are **Compatible**, **Conditional**, **Mismatch**, or **Unknown**. Unknown means the available data is insufficient to establish compatibility.

Overall compatibility uses the most material known condition: Mismatch takes precedence, then Conditional, then Unknown; only fully known compatible signals produce Compatible.

Compatibility is intended to answer "would this specific role work for this candidate?" while qualification continues to answer "does the available evidence support that this candidate can do the work?"

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

Regression tests cover canonical directory evidence, enrichment invariance, title/role-family separation, generated/inferred evidence rejection, provenance, higher-education/EdTech equivalence, transferable capabilities versus title-only evidence, L1-only and irrelevant enriched profiles, location incompatibility, and reviewer validation.
