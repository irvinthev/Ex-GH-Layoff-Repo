# Placement Intelligence MVP

This MVP provides a private, role-first matching workflow for the Ex-GH Talent Network.

## What it does

1. An administrator signs in with a Supabase passwordless email link.
2. The administrator provides a public job URL, a pasted description, or both. Public pages are imported when readable; the paste workflow remains available when a job board blocks automated access.
3. The `evaluate-job` Edge Function verifies the user JWT and checks the server-only admin allowlist.
4. Only opted-in, open-to-work candidates are scored and returned.
5. The page displays the score breakdown, supporting evidence, and gaps requiring review.
   - Results can be sorted (highest score, lowest score, name A-Z) and filtered to strong fits (score ≥ 80).
   - Summary pills include fit distribution, average score, and a CSV export action.

No match is saved, published, or sent to a candidate in this version.

## Scoring model

| Signal | Points |
| --- | ---: |
| Role family | 30 |
| Title / specialty | 15 |
| Skills | 20 |
| Domain | 15 |
| Seniority | 10 |
| Location / work model | 10 |

The matcher uses both literal signals and a controlled set of adjacent concepts, such as implementation/onboarding and workflow/process design. Verified resume evidence can support a secondary role family even when a candidate's former title differs. A stated target role alone is not treated as proof of qualification.

Scores are deterministic decision support. They are not hiring recommendations and always require human review. There are no candidate-specific score bonuses.

## Deployment

- Static page: `placement.html`, `placement.css`, and `placement.js`
- Function: `supabase/functions/evaluate-job/index.ts`
- Function configuration: JWT verification must remain enabled.
- Browser key: the Supabase publishable key in `placement.js` is designed to be public. Never add a service-role key to browser code.
- URL imports accept public HTTPS pages, follow only validated redirects, stop after 10 seconds, and limit downloaded HTML to 1 MB. Imported descriptions are not saved by this MVP.

## Supabase Auth redirect

Add the deployed placement page to **Authentication → URL Configuration → Redirect URLs**:

`https://irvinthev.github.io/Ex-GH-Layoff-Repo/placement.html`

For local testing, also add `http://localhost:8000/placement.html` and serve the repository with a static HTTP server.
