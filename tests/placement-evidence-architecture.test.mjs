import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCandidateProfile,
  prepareJobProfile,
  prepareRole,
  scoreCandidate,
} from "../supabase/functions/evaluate-job/candidate-cache.ts";
import { attachEvidenceLayers } from "../supabase/functions/evaluate-job/evidence-layers.ts";

const productRole = prepareRole({
  slug: "product_management",
  function_name: "Product",
  role_family: "Product Management",
  specialty: null,
  aliases: ["product manager", "technical product manager"],
});

const cambiumLikeJob = prepareJobProfile({
  title: "Technical Product Manager",
  description: [
    "Responsibilities",
    "Lead cross-functional teams and own software product delivery.",
    "Develop product strategy and roadmap execution.",
    "Qualifications",
    "Experience delivering 0-1 products and working across stakeholders.",
  ].join("\n"),
  location: "Remote, United States of America",
  remoteType: "Remote",
});

function row(overrides = {}) {
  return {
    candidate_id: "directory:test",
    first_name: "Test",
    last_name: "Candidate",
    former_job_title: "Sr Product Manager",
    former_team: "Product",
    function_name: "Product",
    location_text: "Chicago",
    linkedin_url: "https://linkedin.com/in/test",
    public_description: "",
    public_skills: [],
    primary_role_slug: null,
    seniority: "senior",
    skills: [],
    domains: [],
    evidence: {},
    role_preferences: [],
    candidate_preferences: null,
    ...overrides,
  };
}

test("directory Description can resolve JD capabilities and preserves provenance", () => {
  const candidate = buildCandidateProfile(row({
    candidate_id: "directory:arushi-regression",
    first_name: "Arushi",
    last_name: "Tayal",
    former_team: "Logistics",
    public_description: "Built 0-1 products that enabled new verticals and opened new revenue streams.",
  }));

  const match = scoreCandidate(candidate, productRole, cambiumLikeJob);

  assert.ok(match.breakdown.skills.score >= 12);
  assert.ok(match.coreCoverage.evidenced.includes("Software product delivery"));
  assert.ok(match.coreCoverage.evidenced.includes("Product strategy"));
  assert.ok(match.evidenceTrace.some((trace) =>
    trace.source === "directory_description" &&
    trace.capability === "Software product delivery"
  ));
});

test("title alone cannot manufacture role-family or skills credit", () => {
  const candidate = buildCandidateProfile(row({
    former_job_title: "Technical Product Manager",
    public_description: "",
    public_skills: [],
  }));
  const match = scoreCandidate(candidate, productRole, cambiumLikeJob);

  assert.equal(match.breakdown.titleSpecialty.score, 15);
  assert.equal(match.breakdown.skills.score, 0);
  assert.ok(match.breakdown.roleFamily.score < 24);
});

test("duplicating the same capability in enriched fields does not add qualification points", () => {
  const publicOnly = buildCandidateProfile(row({
    public_description: "Led cross-functional teams, software product delivery, and product strategy.",
  }));
  const enrichedDuplicate = buildCandidateProfile(row({
    candidate_id: "enriched:test",
    public_description: "Led cross-functional teams, software product delivery, and product strategy.",
    skills: ["Cross-Functional Leadership", "Software Product Delivery", "Product Strategy"],
    evidence: { summary: "Cross-functional leadership, software product delivery, product strategy." },
  }));

  const publicMatch = scoreCandidate(publicOnly, productRole, cambiumLikeJob);
  const enrichedMatch = scoreCandidate(enrichedDuplicate, productRole, cambiumLikeJob);

  assert.equal(enrichedMatch.breakdown.skills.score, publicMatch.breakdown.skills.score);
  assert.equal(enrichedMatch.breakdown.roleFamily.score, publicMatch.breakdown.roleFamily.score);
  assert.equal(enrichedMatch.score, publicMatch.score);
});

test("directory-only L1 plus L2 evidence is reported from the same canonical profile", () => {
  const candidate = buildCandidateProfile(row({
    candidate_id: "directory:l1-l2",
    public_description: "Built and launched 0-1 products for new customer use cases and revenue streams.",
  }));
  const match = scoreCandidate(candidate, productRole, cambiumLikeJob);
  const [attached] = attachEvidenceLayers([match], [candidate]);

  assert.deepEqual(attached.evidenceConfidence.layers, { l1: true, l2: true, l3: false });
  assert.equal(attached.evidenceConfidence.confidence, "Medium");
});

test("enrichment changes evidence depth, not score, when it adds no new capability", () => {
  const publicCandidate = buildCandidateProfile(row({
    candidate_id: "directory:plain",
    public_description: "Led cross-functional teams and product strategy.",
  }));
  const enrichedCandidate = buildCandidateProfile(row({
    candidate_id: "enriched:duplicate",
    public_description: "Led cross-functional teams and product strategy.",
    evidence: { summary: "Led cross-functional teams and product strategy." },
  }));

  const publicMatch = scoreCandidate(publicCandidate, productRole, cambiumLikeJob);
  const enrichedMatch = scoreCandidate(enrichedCandidate, productRole, cambiumLikeJob);
  const [plainAttached] = attachEvidenceLayers([publicMatch], [publicCandidate]);
  const [richAttached] = attachEvidenceLayers([enrichedMatch], [enrichedCandidate]);

  assert.equal(enrichedMatch.score, publicMatch.score);
  assert.equal(richAttached.evidenceConfidence.layers.l3, true);
  assert.equal(plainAttached.evidenceConfidence.layers.l3, false);
});

test("irrelevant directory narrative does not create capability credit", () => {
  const candidate = buildCandidateProfile(row({
    former_job_title: "Operations Manager",
    function_name: "Operations",
    public_description: "Managed scheduling, staffing, and vendor relationships.",
  }));
  const match = scoreCandidate(candidate, productRole, cambiumLikeJob);

  assert.equal(match.breakdown.skills.score, 0);
  assert.equal(match.breakdown.roleFamily.score, 0);
});

test("Paul-style enrichment can supply capability evidence without title credit", () => {
  const candidate = buildCandidateProfile(row({
    candidate_id: "paul-regression",
    first_name: "Paul",
    last_name: "de Lucena",
    former_job_title: "Staff Decision Scientist",
    former_team: "Decision Science / Systems Engineering",
    function_name: "Engineering",
    public_description: "Decision scientist designing systems and models for data-driven strategy.",
    public_skills: ["Machine Learning", "Systems Design", "Analytics"],
    skills: ["Technical Product Management", "Product Strategy", "Cross-Functional Leadership"],
    evidence: { summary: "Led product strategy and cross-functional product work." },
  }));
  const match = scoreCandidate(candidate, productRole, cambiumLikeJob);

  assert.equal(match.breakdown.titleSpecialty.score, 0);
  assert.ok(match.breakdown.skills.score > 0);
  assert.ok(match.breakdown.roleFamily.score <= 24);
});
