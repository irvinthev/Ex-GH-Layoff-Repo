# Candidate pilot

## Release status

The `candidate-portal` Edge Function and `candidate_portal_pilot` database migration are deployed. The candidate page becomes available after this PR is merged and GitHub Pages finishes publishing. Do not share it as ready until the acceptance checks below pass.

Entry point: `candidate.html`. Magic links return to the existing `placement.html` redirect; that page detects an enrolled candidate and routes them to the candidate page. The existing administrator evaluator and newer directory changes are preserved.

Private operational enrollment contains two opted-in candidates, with three existing active curated roles each. No emails, resumes or candidate IDs are included in this public repository. No invitations were sent by this change.

## Access design

- Gateway JWT verification is enabled. Every API request additionally calls Auth `getUser`, requires a confirmed email, checks a server-only active allowlist and checks matching opt-in.
- Every candidate-specific query is scoped to the candidate ID resolved by the server. Caller-supplied candidate IDs are ignored.
- Both new tables have RLS enabled and no anonymous/authenticated table grants. Service-only access is deliberate. Candidate data is not embedded in static files.
- Feedback requests can change only status and an optional note. Import refreshes leave those columns untouched.
- Import throttling is atomic: five attempts per candidate per minute. Remote fetches are limited to explicit ATS hosts and validated again after every redirect. Unsupported hosts require pasted text.

## Evidence limitations

Saved curated summaries are suggestions, not scored matches. Candidate URL imports require a substantial structured JobPosting description; social previews and metadata-only pages fail with a paste fallback. Imported descriptions remain heuristic inputs, not verified qualifications. Pasted descriptions require at least 70 words and 400 characters; this length check does not prove completeness.

Candidate scoring is a versioned copy of the current deterministic matcher with conservative location credit, phrase boundaries and required qualification-review notes. It is not a calibrated probability. The administrator matcher remains unchanged in this release. Consolidating both matchers and improving requirement-level scoring is follow-up work.

## Verification completed

- `node --test tests/candidate-portal.test.mjs`: 14 passing tests, using mocked Auth/database clients.
- JavaScript syntax check for `candidate.js`.
- Live database: three saved roles per enrolled candidate; RLS enabled; anonymous/authenticated read and write grants absent.
- Live database transaction test: sixth import within a minute rejected; test rolled back.
- Live unauthenticated function request returned HTTP 401.
- Security advisor: no-policy information is expected for server-only tables. Existing leaked-password-protection warning remains; this pilot uses magic links.

## Acceptance checks still required before invitations

1. Merge the PR and confirm GitHub Pages publishes `candidate.html` and `candidate.js`.
2. Confirm the project email provider can deliver to enrolled external addresses. Default Supabase email restrictions may require custom SMTP; no delivery was tested or settings changed here.
3. Have one enrolled candidate request their own magic link, follow it, see only their shortlist, save feedback, refresh and confirm persistence.
4. Check mobile layout, sign-out clearing the shortlist, URL import, and pasted-description fallback in the live browser.
5. Recheck saved roles are still open before sharing. Current active flags are internal inventory status, not a fresh employer availability check.

## Operations

Enrollment and revocation are private SQL operations against `candidate_portal_access`, not public code edits. Setting `active=false` denies subsequent portal requests. The API never changes `network_members.auth_user_id` or grants admin access.

Schema source is `supabase/candidate-pilot.sql`, applied once with the migration tool; do not rerun the create statements on an initialized project. Keep migration history in sync when adopting the CLI workflow.

Rollback: revert the frontend PR to remove candidate routing, and disable pilot access (`active=false`) through a reviewed database operation. Retain saved roles and feedback for recovery; no table deletion is necessary.
