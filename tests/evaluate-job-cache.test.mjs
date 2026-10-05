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
  linkedin_url: "https://www.linkedin.com/in/alex-taylor",
  public_description: "Led onboarding, deployment, and customer implementation programs.",
  public_skills: ["Onboarding", "Customer Delivery"],
  primary_role_slug: "implementation-manager",
  seniority: "lead",
  skills: ["Implementation", "Automation"],
  domains: ["Data integration"],
  evidence: { summary: "Led implementation rollout programs." },
  role_preferences: [],
  candidate_preferences: {
    target_titles: ["Implementation Manager"],
    preferred_locations: ["Cambridge, MA"],
    remote_preference: "hybrid",
  },
};

const directoryPerson = {
  "First Name": "Alex",
  "Last Name": "Taylor",
  "Former Job Title": "Implementation Lead",
  "Former Team": "Professional Services",
  "Function": "Customer Success",
  "Location": "Boston, MA",
  "LinkedIn URL": "https://www.linkedin.com/in/alex-taylor",
  "Description": "Led onboarding, deployment, and customer implementation programs.",
  "Top 3 Skills": "Onboarding, Customer Delivery",
  "Open to Work": "Yes",
};

function installDirectoryFetch() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify([directoryPerson]), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
  return () => { globalThis.fetch = originalFetch; };
}

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

function createDelayedAdminStub() {
  const calls = { roles: 0, candidates: 0 };
  let release;
  const waitForRelease = new Promise((resolve) => { release = resolve; });
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

test("candidate cache reuses the canonical merged snapshot inside the TTL window", async () => {
  resetCandidateCacheForTests();
  const restoreFetch = installDirectoryFetch();
  try {
    const admin = createAdminStub();
    const first = await getCandidateCache(admin, 1_000);
    const second = await getCandidateCache(admin, 2_000);

    assert.equal(first.metrics.cacheStatus, "refresh");
    assert.equal(second.metrics.cacheStatus, "hit");
    assert.equal(admin.calls.roles, 1);
    assert.equal(admin.calls.candidates, 1);
    assert.equal(first.cache.candidateCount, 1);
    assert.equal(second.cache.candidateCount, 1);
    assert.equal(first.cache.candidates[0].publicDescription, directoryPerson.Description);
  } finally {
    restoreFetch();
  }
});

test("concurrent cache waiters share one refresh", async () => {
  resetCandidateCacheForTests();
  const restoreFetch = installDirectoryFetch();
  try {
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
  } finally {
    restoreFetch();
  }
});

test("held title and role-family evidence are separate scoring paths", () => {
  const role = prepareRole({
    slug: "product_management",
    function_name: "Product",
    role_family: "Product Management",
    specialty: null,
    aliases: ["product manager", "technical product manager"],
  });
  const candidate = buildCandidateProfile({
    ...candidateRow,
    candidate_id: "title-only",
    first_name: "Title",
    last_name: "Only",
    former_job_title: "Senior Product Manager",
    former_team: "General",
    function_name: "Product",
    public_description: "Experienced professional.",
    public_skills: [],
    skills: [],
    domains: [],
    evidence: {},
  });
  const job = prepareJobProfile({
    title: "Technical Product Manager",
    description: "Lead cross-functional product delivery and own product strategy for a software platform.",
    location: "Remote",
    remoteType: "Remote",
  });

  const match = scoreCandidate(candidate, role, job);
  assert.ok(match.breakdown.titleSpecialty.score >= 10);
  assert.equal(match.breakdown.roleFamily.score, 18);
  assert.equal(match.breakdown.skills.score, 0);
});

test("directory narrative can resolve JD capabilities without enrichment", () => {
  const role = prepareRole({
    slug: "product_management",
    function_name: "Product",
    role_family: "Product Management",
    specialty: null,
    aliases: ["product manager", "technical product manager"],
  });
  const candidate = buildCandidateProfile({
    ...candidateRow,
    candidate_id: "directory-product",
    first_name: "Directory",
    last_name: "Product",
    former_job_title: "Sr Product Manager",
    former_team: "Logistics",
    function_name: "Product",
    public_description: "Built 0-1 products that opened new verticals and new revenue streams.",
    public_skills: [],
    skills: [],
    domains: [],
    evidence: {},
  });
  const job = prepareJobProfile({
    title: "Technical Product Manager",
    description: "Own product strategy and lead product delivery for new product capabilities.",
    location: "Remote",
    remoteType: "Remote",
  });

  const match = scoreCandidate(candidate, role, job);
  assert.ok(match.breakdown.skills.score > 0);
  assert.ok(match.evidenceTrace.some((entry) => entry.source === "directory_description"));
});
