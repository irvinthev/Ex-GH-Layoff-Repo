import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCandidateProfile,
  prepareJobProfile,
  prepareRole,
  scoreCandidate,
} from "../supabase/functions/evaluate-job/candidate-cache.ts";
import {
  attachEvidenceLayers,
  summarizeEvidenceLayers,
} from "../supabase/functions/evaluate-job/evidence-layers.ts";

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
    "Lead cross-functional teams through product delivery.",
    "Own product strategy and roadmap for software products.",
    "Partner with engineering and stakeholders to launch new capabilities.",
  ].join("\n"),
  location: "Remote, United States of America",
  remoteType: "Remote",
});

function baseRow(overrides = {}) {
  return {
    candidate_id: "directory:test",
    first_name: "Test",
    last_name: "Candidate",
    former_job_title: "Sr Product Manager",
    former_team: "Logistics",
    function_name: "Product",
    location_text: "Chicago",
    linkedin_url: "https://www.linkedin.com/in/test-candidate",
    public_description: "Built 0-1 products that opened new verticals and new revenue streams.",
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

test("directory description participates in scoring and evidence depth", () => {
  const profile = buildCandidateProfile(baseRow());
  const match = scoreCandidate(profile, productRole, cambiumLikeJob);
  const [attached] = attachEvidenceLayers([match], [profile]);

  assert.ok(match.breakdown.skills.score > 0);
  assert.equal(attached.evidenceConfidence.layers.l1, true);
  assert.equal(attached.evidenceConfidence.layers.l2, true);
  assert.equal(attached.evidenceConfidence.layers.l3, false);
  assert.equal(attached.evidenceConfidence.confidence, "Medium");
  assert.equal(attached.evidenceSufficiency.sufficiency, "Moderate");
  assert.ok(match.evidenceTrace.some((entry) => entry.source === "directory_description"));
});

test("title alignment alone cannot create role-family credit", () => {
  const profile = buildCandidateProfile(baseRow({
    public_description: "Experienced professional.",
    public_skills: [],
    former_team: "General",
  }));
  const match = scoreCandidate(profile, productRole, cambiumLikeJob);

  assert.ok(match.breakdown.titleSpecialty.score >= 10);
  assert.equal(match.breakdown.roleFamily.score, 18);
});

test("irrelevant directory narrative does not create capability points", () => {
  const profile = buildCandidateProfile(baseRow({
    public_description: "Managed restaurant vendor invoices and office scheduling.",
    public_skills: [],
  }));
  const match = scoreCandidate(profile, productRole, cambiumLikeJob);

  assert.equal(match.breakdown.skills.score, 0);
  assert.equal(match.evidenceTrace.some((entry) => entry.source === "directory_description" && entry.capability !== "Title alignment"), false);
});

test("enrichment depth is metadata and cannot change score when evidence is duplicated", () => {
  const directoryProfile = buildCandidateProfile(baseRow());
  const enrichedProfile = buildCandidateProfile(baseRow({
    candidate_id: "enriched:test",
    skills: ["Product Strategy", "Product Delivery"],
    evidence: {
      summary: "Built 0-1 products that opened new verticals and new revenue streams.",
    },
  }));

  const directoryMatch = scoreCandidate(directoryProfile, productRole, cambiumLikeJob);
  const enrichedMatch = scoreCandidate(enrichedProfile, productRole, cambiumLikeJob);

  assert.equal(directoryMatch.score, enrichedMatch.score);

  const [directoryAttached, enrichedAttached] = attachEvidenceLayers(
    [directoryMatch, enrichedMatch],
    [directoryProfile, enrichedProfile],
  );
  assert.equal(directoryAttached.evidenceConfidence.layers.l3, false);
  assert.equal(enrichedAttached.evidenceConfidence.layers.l3, true);
  assert.equal(directoryAttached.evidenceSufficiency.sufficiency, "Moderate");
  assert.equal(enrichedAttached.evidenceSufficiency.sufficiency, "High");
  assert.equal(directoryAttached.score, enrichedAttached.score);
  assert.equal(directoryAttached.fitBand, directoryMatch.fitBand);
  assert.equal(enrichedAttached.fitBand, enrichedMatch.fitBand);
});

test("canonical merged profile exposes directory and enrichment layers together", () => {
  const profile = buildCandidateProfile(baseRow({
    candidate_id: "merged:test",
    public_description: "Built 0-1 products that opened new verticals and new revenue streams.",
    public_skills: ["Product Strategy"],
    skills: ["Technical Product Management"],
    domains: ["Software"],
    evidence: { verified_signals: ["Led product delivery with engineering"] },
  }));

  const summary = summarizeEvidenceLayers(profile);
  assert.deepEqual(summary.layers, { l1: true, l2: true, l3: true });

  const match = scoreCandidate(profile, productRole, cambiumLikeJob);
  assert.ok(match.evidenceTrace.some((entry) => entry.source === "directory_description"));
  assert.ok(match.evidenceTrace.some((entry) =>
    entry.source === "public_skill" ||
    entry.source === "enriched_skill" ||
    entry.source === "enriched_evidence"
  ));
});


test("sparse profile evidence does not downgrade qualification fit band", () => {
  const sparseProfile = buildCandidateProfile(baseRow({
    candidate_id: "directory:sparse",
    public_description: "",
    public_skills: [],
    skills: [],
    domains: [],
    evidence: {},
  }));
  const sparseMatch = scoreCandidate(sparseProfile, productRole, cambiumLikeJob);
  const [attached] = attachEvidenceLayers([sparseMatch], [sparseProfile]);

  assert.equal(attached.fitBand, sparseMatch.fitBand);
  assert.equal(attached.evidenceSufficiency.sufficiency, "Limited");
  assert.equal(attached.evidenceAssessment.bandAdjusted, false);
  assert.match(attached.evidenceSufficiency.note, /unknown, not absent/i);
});
