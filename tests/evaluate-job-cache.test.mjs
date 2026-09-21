import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCandidateProfile,
  getCandidateCache,
  prepareJobProfile,
  prepareRole,
  resetCandidateCacheForTests,
  scoreCandidate,
} from "../supabase/functions/evaluate-job/candidate-cache.ts";

const roleRecord = {
  slug: "implementation-manager",
  function_name: "Customer Success",
  role_family: "Implementation",
  specialty: "Onboarding",
  aliases: ["deployment"],
};

const candidateRow = {
  candidate_id: "candidate-1",
  first_name: "Alex",
  last_name: "Taylor",
  former_job_title: "Implementation Lead",
  former_team: "Professional Services",
  function_name: "Customer Success",
  location_text: "Boston, MA",
  linkedin_url: "https://example.com/alex",
  public_description: "Led onboarding, deployment, and customer implementation programs.",
  public_skills: ["Onboarding", "Customer Delivery"],
  primary_role_slug: "implementation-manager",
  seniority: "lead",
  skills: ["Implementation", "Automation"],
  domains: ["Data integration"],
  evidence: { summary: "implementation rollout" },
  role_preferences: [
    { role_slug: "implementation-manager", preference: "avoid", priority: 1 },
  ],
  candidate_preferences: {
    target_titles: ["Implementation Manager"],
    preferred_locations: ["Cambridge, MA"],
    remote_preference: "hybrid",
  },
};

function createAdminStub() {
  const calls = { roles: 0, candidates: 0 };
  return {
    calls,
    from(table) {
      return {
        select() {
          if (table === "role_taxonomy") {
            return {
              eq() {
                calls.roles += 1;
                return Promise.resolve({ data: [roleRecord], error: null });
              },
            };
          }
          if (table === "placement_candidate_cache") {
            calls.candidates += 1;
            return Promise.resolve({ data: [candidateRow], error: null });
          }
          throw new Error(`Unexpected table: ${table}`);
        },
      };
    },
  };
}

test("candidate cache reuses the in-memory snapshot inside the TTL window", async () => {
  resetCandidateCacheForTests();
  const admin = createAdminStub();

  const first = await getCandidateCache(admin, 1_000);
  const second = await getCandidateCache(admin, 2_000);

  assert.equal(first.metrics.cacheStatus, "refresh");
  assert.equal(second.metrics.cacheStatus, "hit");
  assert.equal(admin.calls.roles, 1);
  assert.equal(admin.calls.candidates, 1);
  assert.equal(first.cache.candidateCount, 1);
  assert.equal(second.cache.candidateCount, 1);
});

test("scoreCandidate uses precomputed candidate preferences and token maps", () => {
  const role = prepareRole(roleRecord);
  const candidate = buildCandidateProfile(candidateRow);
  const job = prepareJobProfile({
    title: "Implementation Manager",
    description: "Lead customer onboarding, deployment, and data integration programs for enterprise clients.",
    location: "Boston, MA",
    remoteType: "Hybrid",
  });

  const match = scoreCandidate(candidate, role, job);

  assert.equal(match.breakdown.roleFamily.score, 0);
  assert.match(match.gaps.join(" | "), /role to avoid/);
  assert.ok(match.reasons.some((reason) => reason.includes("Skills named in role")));
  assert.ok(match.reasons.some((reason) => reason.includes("Relevant domain evidence")));
  assert.equal(match.candidate.skills.includes("Implementation"), true);
});
