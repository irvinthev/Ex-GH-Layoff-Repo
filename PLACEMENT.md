# Placement Intelligence MVP

This MVP provides a private, role-first matching workflow for the TalentBot HQ.

## What it does

1. An administrator signs in with a Supabase passwordless email link.
2. The administrator provides a public job URL, a pasted description, or both. Public pages are imported when readable; the paste workflow remains available when a job board blocks automated access.
3. The `evaluate-job` Edge Function verifies the user JWT and checks the server-only admin allowlist.
4. Only opted-in, open-to-work candidates are scored and returned.
5. The page displays the score breakdown, supporting evidence, and gaps requiring review.
   - Results can be sorted (highest score, lowest score, name A-Z) and filtered to strong fits (score ≥ 80).
   - Summary pills include fit distribution, average score, and a CSV export action.

Evaluation history is saved privately for administrators. Candidate recommendations and observed outcomes can also be recorded in `placement_calibration_feedback` for calibration. Calibration outcomes are analytics labels only: they never add candidate-specific bonuses to the fit score.

## Scoring model

| Signal | Points |
| --- | ---: |
| Role family | 30 |
| Title / specialty | 15 |
| Skills | 20 |
| Domain | 15 |
| Seniority | 10 |
| Location / work model | 10 |

The matcher uses both literal signals and controlled semantic concept groups. V7 expands equivalencies for product marketing/GTM, education technology/higher education, operations execution, technical program delivery, product strategy, platform/integrations, fintech/payments, finance systems, and the existing implementation/procurement concepts. Verified resume evidence can support a secondary role family even when a candidate's former title differs. A stated target role alone is not treated as proof of qualification.

The weights and fit thresholds are unchanged. Semantic expansion improves evidence recognition rather than inflating scores.

Scores are deterministic decision support. They are not hiring recommendations and always require human review. There are no candidate-specific score bonuses.

## Deployment

- Static page: `placement.html`, `placement.css`, and `placement.js`
- Function: `supabase/functions/evaluate-job/index.ts`
- Cache helpers: `supabase/functions/evaluate-job/candidate-cache.ts` and `supabase/functions/evaluate-job/types.ts`
- Function configuration: JWT verification must remain enabled.
- Candidate data is loaded from the `placement_candidate_cache` materialized view and refreshed daily via `pg_cron`; in-memory function cache TTL is 1 hour per isolate.
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

Regression tests cover the semantic failure modes exposed by the first validation set, including higher-education/EdTech equivalence and transferable logistics/operations evidence.
