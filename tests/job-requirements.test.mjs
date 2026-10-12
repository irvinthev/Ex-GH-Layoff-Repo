import test from "node:test";
import assert from "node:assert/strict";
import {
  applyJobRequirementReview,
  parseJobRequirementUnits,
  parseJobRequirements,
  validateJobRequirementUnit,
} from "../supabase/functions/evaluate-job/job-requirements.ts";
import { mapCandidateToCoreRequirements } from "../supabase/functions/evaluate-job/requirement-mapping.ts";
import {
  buildCandidateProfile,
  prepareJobProfile,
  prepareRole,
  scoreCandidate,
} from "../supabase/functions/evaluate-job/candidate-cache.ts";

const BRAZE_BENCHMARK = `Requirements:
- Experience with enterprise SaaS pricing experience is required.

Preferred Qualifications:
- Commercial monetization experience is a plus.`;

function buildJob(description = BRAZE_BENCHMARK) {
  return prepareJobProfile({
    title: "Senior Monetization Strategy Manager",
    description,
    location: "New York",
    remoteType: "Hybrid",
  });
}

function buildCandidate() {
  return buildCandidateProfile({
    candidate_id: "synthetic:requirements-test",
    first_name: "Test",
    last_name: "Candidate",
    former_job_title: "Senior Data Analyst",
    former_team: "Analytics",
    function_name: "Data & Analytics",
    location_text: "New York",
    linkedin_url: null,
    public_description: "Built SQL queries and analytics dashboards for product and commercial teams.",
    public_skills: ["SQL", "Data Analysis", "Dashboard Building"],
    primary_role_slug: null,
    seniority: "senior",
    skills: [],
    domains: [],
    evidence: {},
    role_preferences: [],
    candidate_preferences: null,
  });
}

test("parses Braze-style core and preferred hiring intent without promoting monetization", () => {
  const job = buildJob();
  const pricing = job.requirementsStructured.find((item) => /enterprise saas pricing/i.test(item.originalText));
  const monetization = job.requirementsStructured.find((item) => /commercial monetization/i.test(item.originalText));

  assert.ok(pricing);
  assert.equal(pricing.category, "core");
  assert.equal(pricing.sourceSection, "Requirements");
  assert.match(pricing.originalText, /enterprise SaaS pricing experience is required/);
  assert.ok(monetization);
  assert.equal(monetization.category, "preferred");
  assert.equal(monetization.flexibility, undefined);
  assert.ok(monetization.ambiguityFlags.includes("multiple_interpretations"));
  assert.equal(parseJobRequirementUnits(job).find((unit) => unit.requirementId === monetization.requirementId).parseStatus, "unparsed");
  assert.ok(job.requirementsStructured.some((item) => item.sourceSection === "Job title"));
  assert.ok(job.requirementsStructured.some((item) => item.sourceSection === "Job location"));
});

test("keeps unrecognized requirements and marks parsed capability units explicitly", () => {
  const requirements = parseJobRequirements(buildJob(`Requirements:
- Bring a thoughtful approach to complex launch readiness.
- Experience with SQL.`));
  const unrecognized = requirements.find((item) => /thoughtful approach/i.test(item.originalText));
  const sql = requirements.find((item) => item.label.toLowerCase() === "sql");

  assert.ok(unrecognized);
  assert.equal(unrecognized.category, "ambiguous");
  assert.ok(unrecognized.ambiguityFlags.includes("unrecognized_requirement"));
  const units = parseJobRequirementUnits(buildJob(`Requirements:
- Experience with SQL.`));
  assert.equal(units[0].parsedCapability, "SQL");
  assert.equal(units[0].parseStatus, "parsed");
  assert.equal(validateJobRequirementUnit(units[0], buildJob(`Requirements:
- Experience with SQL.`).requirementsStructured[0]), true);
  assert.ok(sql);
});

test("admin override is stored beside original wording and preferred promotion requires explicit review", () => {
  const requirements = buildJob().requirementsStructured;
  const preferred = requirements.find((item) => item.category === "preferred");
  const unreviewed = applyJobRequirementReview(requirements, {
    requirements: [{
      requirementId: preferred.requirementId,
      interpretedAs: "Commercial pricing or monetization experience",
      flexibility: "mandatory",
      markedReviewed: false,
    }],
  });
  assert.equal(unreviewed.find((item) => item.requirementId === preferred.requirementId).flexibility, undefined);

  const reviewed = applyJobRequirementReview(requirements, {
    requirements: [{
      requirementId: preferred.requirementId,
      interpretedAs: "Commercial pricing or monetization experience",
      flexibility: "mandatory",
      markedReviewed: true,
    }],
  });
  const override = reviewed.find((item) => item.requirementId === preferred.requirementId);
  assert.equal(override.category, "preferred");
  assert.equal(override.flexibility, "mandatory");
  assert.equal(override.interpretedAs, "Commercial pricing or monetization experience");
  assert.equal(override.originalText, preferred.originalText);
  const reviewedJob = { ...buildJob(), requirementsStructured: reviewed };
  const preferredUnit = parseJobRequirementUnits(reviewedJob).find((unit) => unit.requirementId === preferred.requirementId);
  assert.equal(preferredUnit.adminConfirmedInterpretation, override.interpretedAs);
  assert.equal(validateJobRequirementUnit(preferredUnit, override, false), false);
  assert.equal(validateJobRequirementUnit(preferredUnit, override, true), true);
});

test("evidence mapping is informational and requirement review leaves scoring unchanged", () => {
  const role = prepareRole({
    slug: "data-analyst",
    function_name: "Data & Analytics",
    role_family: "Data Analyst",
    specialty: "Business Intelligence",
    aliases: ["data analyst", "analytics analyst"],
  });
  const job = buildJob(`Requirements:
- SQL and data analysis experience required.`);
  const candidate = buildCandidate();
  const baseline = scoreCandidate(candidate, role, job);
  const review = applyJobRequirementReview(job.requirementsStructured, {
    topCapabilities: "SQL, analytics",
    adjacentExperience: "yes",
    requirements: job.requirementsStructured.map((item) => ({
      requirementId: item.requirementId,
      interpretedAs: `${item.label} or equivalent`,
      flexibility: "flexible",
      markedReviewed: true,
    })),
  });
  job.requirementsStructured = review;
  const scored = scoreCandidate(candidate, role, job);
  const links = mapCandidateToCoreRequirements(review, [scored]);

  assert.equal(scored.score, baseline.score);
  assert.equal(scored.fitBand, baseline.fitBand);
  assert.deepEqual(scored.coreCoverage, baseline.coreCoverage);
  assert.ok(links.every((link) => link.reviewStatus === "supported" && link.matchStrength === "exact"));
  assert.equal(links.some((link) => link.capabilityLabel.toLowerCase() === "sql"), true);
  assert.equal(links.some((link) => link.capabilityLabel.toLowerCase() === "data analysis"), true);
  assert.equal(links.some((link) => link.candidateEvidenceText.length > 0), true);
});
