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

          function createDelayedAdminStub() {
            const calls = { roles: 0, candidates: 0 };
            let release;
            const waitForRelease = new Promise((resolve) => {
              release = resolve;
            });
            return {
              calls,
              release,
              from(table) {
                return {
                  select() {
                    if (table === "role_taxonomy") {
                      return {
                        eq() {
                          calls.roles += 1;
                          return waitForRelease.then(() => ({ data: [roleRecord], error: null }));
                        },
                      };
                    }
                    if (table === "placement_candidate_cache") {
                      calls.candidates += 1;
                      return waitForRelease.then(() => ({ data: [candidateRow], error: null }));
                    }
                    throw new Error(`Unexpected table: ${table}`);
                  },
                };
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

test("concurrent cache waiters do not report themselves as refresh owners", async () => {
  resetCandidateCacheForTests();
  const admin = createDelayedAdminStub();

  const firstPromise = getCandidateCache(admin, 3_000);
  const secondPromise = getCandidateCache(admin, 3_000);
  admin.release();

  const [first, second] = await Promise.all([firstPromise, secondPromise]);
  assert.equal(first.metrics.cacheStatus, "refresh");
  assert.equal(second.metrics.cacheStatus, "hit");
  assert.equal(second.metrics.databaseQueryMs, 0);
  assert.equal(admin.calls.roles, 1);
  assert.equal(admin.calls.candidates, 1);
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


test("semantic concepts recognize higher education as education technology", () => {
  const role = prepareRole({
    slug: "product_management",
    function_name: "Product",
    role_family: "Product Management",
    specialty: null,
    aliases: ["product manager", "technical product manager"],
  });
  const candidate = buildCandidateProfile({
    candidate_id: "paul-regression",
    first_name: "Paul",
    last_name: "Regression",
    former_job_title: "Staff Technical Product Manager",
    former_team: "Decision Science / Systems Engineering",
    function_name: "Product",
    location_text: "New York, NY",
    linkedin_url: null,
    public_description: "Technical product leader with deep education technology and platform experience.",
    public_skills: ["Product Strategy", "Enterprise Architecture", "API & Integration Strategy"],
    primary_role_slug: "product_management",
    seniority: "lead",
    skills: ["Technical Product Management", "Product Strategy", "Enterprise Architecture"],
    domains: ["Education Technology", "Platform & Integrations"],
    evidence: { summary: "15 years in education technology and learning platforms" },
    role_preferences: [{ role_slug: "product_management", preference: "target", priority: 1 }],
    candidate_preferences: {
      target_titles: ["Senior Technical Product Manager", "Staff Product Manager"],
      preferred_locations: ["New York, NY"],
      remote_preference: "unknown",
    },
  });
  const job = prepareJobProfile({
    title: "Senior Product Manager",
    description: "Own product strategy and roadmap for a higher education platform serving universities. Lead user research, product discovery, integrations, and launch execution.",
    location: "New York, NY",
    remoteType: "Hybrid",
  });

  const match = scoreCandidate(candidate, role, job);
  assert.ok(match.breakdown.skills.score >= 12);
  assert.ok(match.breakdown.domain.score >= 4);
  assert.ok(match.reasons.some((reason) => reason.includes("Transferable experience")));
});

test("semantic concepts recognize logistics leadership as adjacent operations execution", () => {
  const role = prepareRole({
    slug: "business_operations",
    function_name: "Operations",
    role_family: "Business Operations",
    specialty: null,
    aliases: ["operations manager", "strategy and operations"],
  });
  const candidate = buildCandidateProfile({
    candidate_id: "kelsey-regression",
    first_name: "Kelsey",
    last_name: "Regression",
    former_job_title: "Operations Manager - Front Line Logistics",
    former_team: "Care / Logistics",
    function_name: "Operations",
    location_text: "Mullica Hill, NJ",
    linkedin_url: null,
    public_description: "Senior operations leader across logistics, high-volume teams, capacity planning, Lean process improvement, SLA management, and cross-functional execution.",
    public_skills: ["Operations Management", "Logistics", "Capacity Planning", "Lean Six Sigma", "Process Improvement"],
    primary_role_slug: "business_operations",
    seniority: "manager",
    skills: ["Operations Management", "Logistics", "Capacity Planning", "Labor Allocation", "Lean Six Sigma", "Kaizen", "SLA Management", "People Management"],
    domains: ["Operations", "Logistics", "Fulfillment", "Process Improvement"],
    evidence: { summary: "Managed 100-400 associates in high-volume fulfillment and led Kaizen improvements." },
    role_preferences: [],
    candidate_preferences: {
      target_titles: [],
      preferred_locations: [],
      remote_preference: null,
    },
  });
  const job = prepareJobProfile({
    title: "Senior Operations Manager",
    description: "Lead site operations, operational performance, service levels, labor planning, continuous improvement, and cross-functional execution in a high-volume environment.",
    location: "New Jersey",
    remoteType: "On-site",
  });

  const match = scoreCandidate(candidate, role, job);
  assert.ok(match.breakdown.skills.score >= 12);
  assert.ok(match.breakdown.domain.score >= 4);
  assert.ok(match.reasons.some((reason) => reason.includes("Transferable experience")));
});
