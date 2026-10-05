import test from "node:test";
import assert from "node:assert/strict";
import { buildCandidateProfile, prepareJobProfile, prepareRole, scoreCandidate } from "../supabase/functions/evaluate-job/candidate-cache.ts";
import { saveReviewerEvidence, withReviewerEvidence } from "../supabase/functions/evaluate-job/reviewer-evidence.ts";

const role = prepareRole({ slug: "data_analytics", function_name: "Data & Analytics", role_family: "Data Analytics", specialty: null, aliases: ["data analyst"] });
const job = prepareJobProfile({ title: "Data Analyst", description: "Responsibilities\nUse SQL for data analysis. Build dashboards and recurring reports.", location: "Remote", remoteType: "Remote" });
const row = (overrides = {}) => ({ candidate_id: "synthetic:reviewed", first_name: "Synthetic", last_name: "Reviewed", former_job_title: "Operations Associate", former_team: "Operations", function_name: "Operations", location_text: "Chicago", linkedin_url: null, public_description: "Coordinated vendor logistics.", public_skills: [], primary_role_slug: null, seniority: null, skills: [], domains: [], evidence: {}, role_preferences: [], candidate_preferences: null, ...overrides });
const record = (overrides = {}) => ({ candidate_id: "synthetic:reviewed", evidence_type: "capability", value: "sql", status: "validated", source_type: "linkedin", source_url: null, note: null, reviewed_by: "r@example.com", reviewed_at: "2026-10-05T00:00:00Z", active: true, ...overrides });
const scoreWith = (records, target = job) => scoreCandidate(withReviewerEvidence(buildCandidateProfile(row()), records), role, target);

test("validated capability resolves a matching JD requirement without bonus", () => {
  const base = scoreWith([]);
  const reviewed = scoreWith([record()]);
  assert.ok(!base.coreCoverage.evidenced.includes("sql"));
  assert.ok(reviewed.coreCoverage.evidenced.includes("sql"));
  assert.ok(reviewed.breakdown.skills.score > base.breakdown.skills.score);
  const legitimate = scoreCandidate(buildCandidateProfile(row({ public_skills: ["SQL"] })), role, job);
  assert.equal(reviewed.breakdown.skills.score, legitimate.breakdown.skills.score);
  const trace = reviewed.evidenceTrace.find((entry) => entry.capability === "sql");
  assert.equal(trace.source, "reviewer_validated");
  assert.equal(trace.reviewerSourceType, "linkedin");
});

test("validated capability has no effect when the JD does not require it", () => {
  const target = prepareJobProfile({ title: "Data Analyst", description: "Responsibilities\nBuild dashboards and recurring reports.", location: "Remote", remoteType: "Remote" });
  const base = scoreWith([], target);
  const reviewed = scoreWith([record({ value: "python" })], target);
  assert.equal(reviewed.score, base.score);
  assert.deepEqual(reviewed.coreCoverage, base.coreCoverage);
});

test("rejected capability earns no points", () => {
  const base = scoreWith([]);
  const rejected = scoreWith([record({ status: "rejected" })]);
  assert.equal(rejected.score, base.score);
  assert.ok(!rejected.coreCoverage.evidenced.includes("sql"));
});

test("validated title does not overwrite the held title or title score", () => {
  const base = scoreWith([]);
  const reviewed = scoreWith([record({ evidence_type: "title", value: "Data Analyst" })]);
  assert.equal(reviewed.candidate.formerJobTitle, "Operations Associate");
  assert.equal(reviewed.breakdown.titleSpecialty.score, base.breakdown.titleSpecialty.score);
  assert.equal(reviewed.reviewerEvidence[0].value, "Data Analyst");
});

function fakeAdmin(allowlisted) {
  const writes = [];
  const from = (table) => {
    const chain = {
      select: () => chain, eq: () => chain, in: () => chain,
      maybeSingle: async () => ({ data: allowlisted ? { email: "r@example.com" } : null, error: null }),
      update: (values) => { writes.push({ table, op: "update", values }); return chain; },
      insert: (values) => { writes.push({ table, op: "insert", values }); return chain; },
      single: async () => ({ data: { id: "1" }, error: null }),
      then: (resolve) => resolve({ data: [], error: null }),
    };
    return chain;
  };
  return { from, writes };
}

test("unauthorized users cannot write reviewer evidence", async () => {
  const admin = fakeAdmin(false);
  const result = await saveReviewerEvidence(admin, "intruder@example.com", { candidateId: "c1", evidenceType: "capability", value: "sql", status: "validated", sourceType: "linkedin" });
  assert.equal(result.status, 403);
  assert.equal(admin.writes.length, 0);
});

test("authorized reviewers can write and invalid input is rejected", async () => {
  const admin = fakeAdmin(true);
  const ok = await saveReviewerEvidence(admin, "r@example.com", { candidateId: "c1", evidenceType: "capability", value: "sql", status: "validated", sourceType: "linkedin", sourceUrl: "https://linkedin.com/in/x" });
  assert.equal(ok.status, 200);
  assert.equal(admin.writes.filter((w) => w.op === "insert").length, 1);
  const bad = await saveReviewerEvidence(admin, "r@example.com", { candidateId: "c1", evidenceType: "capability", value: "sql", status: "validated", sourceType: "nope" });
  assert.equal(bad.status, 400);
  const badUrl = await saveReviewerEvidence(admin, "r@example.com", { candidateId: "c1", evidenceType: "capability", value: "sql", status: "validated", sourceType: "other", sourceUrl: "javascript:alert(1)" });
  assert.equal(badUrl.status, 400);
});
