import {
  buildCandidateProfile,
  prepareJobProfile,
  prepareRole,
  scoreCandidate,
} from "./candidate-cache.ts";
import type { PlacementCandidateCacheRow, Role } from "./types.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

const DATA_ANALYST_ROLE: Role = {
  slug: "data-analyst",
  function_name: "Data & Analytics",
  role_family: "Data Analyst",
  specialty: "Business Intelligence",
  aliases: ["data analyst", "analytics analyst", "business intelligence analyst"],
};

const SOFTWARE_ENGINEER_ROLE: Role = {
  slug: "software-engineer",
  function_name: "Engineering",
  role_family: "Software Engineer",
  specialty: "Backend",
  aliases: ["software engineer", "backend engineer", "java engineer"],
};

function candidate(overrides: Partial<PlacementCandidateCacheRow> = {}): PlacementCandidateCacheRow {
  return {
    candidate_id: "synthetic:base",
    first_name: "Synthetic",
    last_name: "Candidate",
    former_job_title: "Senior Lead Associate",
    former_team: "Operations",
    function_name: "Operations",
    location_text: "Chicago",
    linkedin_url: null,
    public_description: "Built SQL queries and metrics dashboards in Redash, translating business questions into operational reports.",
    public_skills: ["SQL Querying", "Data Analysis", "Dashboard Building"],
    primary_role_slug: null,
    seniority: "lead",
    skills: [],
    domains: [],
    evidence: {},
    role_preferences: [],
    candidate_preferences: null,
    ...overrides,
  };
}

function dataAnalystJob() {
  return prepareJobProfile({
    title: "Junior Data Analyst",
    description: "Entry level analyst role using SQL, dashboards, reporting, KPI tracking, data quality checks, and operational analysis.",
    location: "Chicago",
    remoteType: "Hybrid",
  });
}

Deno.test("architectural invariant: enrichment intent metadata cannot increase qualification score or band", () => {
  const role = prepareRole(DATA_ANALYST_ROLE);
  const job = dataAnalystJob();

  const baseline = scoreCandidate(buildCandidateProfile(candidate()), role, job);
  const enrichedIntentOnly = scoreCandidate(buildCandidateProfile(candidate({
    candidate_id: "synthetic:intent-enriched",
    primary_role_slug: "data-analyst",
    role_preferences: [{ role_slug: "data-analyst", preference: "target", priority: 1 }],
    candidate_preferences: {
      target_titles: ["Data Analyst", "Business Intelligence Analyst"],
      preferred_locations: [],
      remote_preference: null,
    },
  })), role, job);

  assertEqual(enrichedIntentOnly.score, baseline.score, "Intent-only enrichment changed qualification score");
  assertEqual(enrichedIntentOnly.fitBand, baseline.fitBand, "Intent-only enrichment changed qualification band");
  assertEqual(
    enrichedIntentOnly.breakdown.roleFamily.score,
    baseline.breakdown.roleFamily.score,
    "Intent-only enrichment changed role-family score",
  );
  assertEqual(
    enrichedIntentOnly.breakdown.titleSpecialty.score,
    baseline.breakdown.titleSpecialty.score,
    "Target titles changed title qualification score",
  );
});

Deno.test("architectural invariant: intent cannot substitute for missing qualification evidence", () => {
  const role = prepareRole(DATA_ANALYST_ROLE);
  const job = dataAnalystJob();

  const noEvidence = scoreCandidate(buildCandidateProfile(candidate({
    candidate_id: "synthetic:no-evidence",
    public_description: "Operations associate supporting day-to-day team workflows.",
    public_skills: [],
    seniority: "entry",
  })), role, job);

  const intentOnly = scoreCandidate(buildCandidateProfile(candidate({
    candidate_id: "synthetic:intent-only",
    public_description: "Operations associate supporting day-to-day team workflows.",
    public_skills: [],
    seniority: "entry",
    primary_role_slug: "data-analyst",
    role_preferences: [{ role_slug: "data-analyst", preference: "target", priority: 1 }],
    candidate_preferences: {
      target_titles: ["Data Analyst"],
      preferred_locations: [],
      remote_preference: null,
    },
  })), role, job);

  assertEqual(intentOnly.score, noEvidence.score, "Intent created qualification points without evidence");
  assertEqual(intentOnly.fitBand, noEvidence.fitBand, "Intent changed recommendation band without evidence");
});

Deno.test("architectural invariant: demonstrated capability can surface a misleading-title candidate", () => {
  const role = prepareRole(DATA_ANALYST_ROLE);
  const job = dataAnalystJob();

  const capabilityCandidate = scoreCandidate(buildCandidateProfile(candidate({
    candidate_id: "synthetic:dan-shaped",
  })), role, job);

  const metadataOnlyCandidate = scoreCandidate(buildCandidateProfile(candidate({
    candidate_id: "synthetic:metadata-shaped",
    public_description: "Customer support specialist handling escalations and cross-functional issue resolution.",
    public_skills: ["Problem Solving"],
    primary_role_slug: "data-analyst",
    role_preferences: [{ role_slug: "data-analyst", preference: "target", priority: 1 }],
    candidate_preferences: {
      target_titles: ["Data Analyst"],
      preferred_locations: [],
      remote_preference: null,
    },
    seniority: "entry",
  })), role, job);

  assert(
    capabilityCandidate.score > metadataOnlyCandidate.score,
    `Demonstrated analytics capability should outrank intent-only metadata (${capabilityCandidate.score} <= ${metadataOnlyCandidate.score})`,
  );
});

Deno.test("architectural invariant: generic occupational title words cannot create specialty alignment", () => {
  const role = prepareRole(DATA_ANALYST_ROLE);
  const job = dataAnalystJob();

  const helpdeskAnalyst = scoreCandidate(buildCandidateProfile(candidate({
    candidate_id: "synthetic:helpdesk-analyst",
    former_job_title: "Helpdesk Analyst II",
    function_name: "Customer Care & Support",
    public_description: "Helpdesk analyst providing IT support and issue resolution.",
    public_skills: ["IT Support", "Troubleshooting"],
    seniority: "mid",
  })), role, job);

  assertEqual(
    helpdeskAnalyst.breakdown.titleSpecialty.score,
    0,
    "Shared generic word 'Analyst' created false title-specialty alignment",
  );
});

Deno.test("architectural invariant: stronger capability evidence cannot be suppressed by seniority mismatch", () => {
  const role = prepareRole(DATA_ANALYST_ROLE);
  const job = dataAnalystJob();

  const strongCapabilitySenior = scoreCandidate(buildCandidateProfile(candidate({
    candidate_id: "synthetic:strong-capability-senior",
    former_job_title: "Senior Lead Associate",
    public_description: "Built SQL queries, Redash dashboards, KPI reporting, and operational analyses for business teams.",
    public_skills: ["SQL Querying", "Data Analysis", "Dashboard Building"],
    seniority: "lead",
  })), role, job);

  const weakCapabilityJunior = scoreCandidate(buildCandidateProfile(candidate({
    candidate_id: "synthetic:weak-capability-junior",
    former_job_title: "Junior Analyst",
    function_name: "Operations",
    public_description: "Supported general operations reporting and coordination.",
    public_skills: ["Reporting"],
    seniority: "entry",
  })), role, job);

  assert(
    strongCapabilitySenior.score > weakCapabilityJunior.score,
    `Strong capability evidence should outrank weaker evidence despite seniority mismatch (${strongCapabilitySenior.score} <= ${weakCapabilityJunior.score})`,
  );
});

Deno.test("architectural invariant: job title cannot manufacture skill evidence", () => {
  const role = prepareRole(DATA_ANALYST_ROLE);
  const job = prepareJobProfile({
    title: "Junior Data Analyst",
    description: "Coordinate recurring operational work and communicate status updates.",
    location: "Chicago",
    remoteType: "Hybrid",
  });

  const candidateWithDataAnalysis = scoreCandidate(buildCandidateProfile(candidate({
    candidate_id: "synthetic:title-only-skill",
    public_description: "Operations associate.",
    public_skills: ["Data Analysis"],
    seniority: "entry",
  })), role, job);

  assertEqual(
    candidateWithDataAnalysis.breakdown.skills.score,
    0,
    "The words Data Analyst in the job title created skill evidence not present in the description",
  );
});

Deno.test("architectural invariant: contextual overlap cannot outweigh core requirement evidence", () => {
  const role = prepareRole(DATA_ANALYST_ROLE);
  const job = prepareJobProfile({
    title: "Junior Data Analyst",
    description: "Use SQL to analyze data, build dashboards, create recurring reports, and communicate findings cross-functionally.",
    location: "Remote",
    remoteType: "Remote",
  });

  const coreEvidenceCandidate = scoreCandidate(buildCandidateProfile(candidate({
    candidate_id: "synthetic:core-evidence",
    public_description: "Built SQL queries, dashboards, and recurring reports for operations teams.",
    public_skills: ["SQL Querying", "Data Analysis", "Dashboard Building"],
    seniority: "lead",
  })), role, job);

  const contextualCandidate = scoreCandidate(buildCandidateProfile(candidate({
    candidate_id: "synthetic:contextual",
    former_job_title: "Technical Product Manager",
    public_description: "Led cross-functional teams and operational planning.",
    public_skills: ["Technical Product Management", "Cross-Functional Leadership", "Operations Management"],
    seniority: "senior",
  })), role, job);

  assert(
    coreEvidenceCandidate.breakdown.skills.score > contextualCandidate.breakdown.skills.score,
    `Core requirement evidence should score above contextual overlap (${coreEvidenceCandidate.breakdown.skills.score} <= ${contextualCandidate.breakdown.skills.score})`,
  );
});

Deno.test("architectural invariant: explicit technical role requires named technical evidence", () => {
  const role = prepareRole(SOFTWARE_ENGINEER_ROLE);
  const job = prepareJobProfile({
    title: "Senior Java Software Engineer",
    description: "Build backend services in Java and Spring Boot. Experience with Java is required.",
    location: "Remote",
    remoteType: "Remote",
  });

  const genericEngineer = scoreCandidate(buildCandidateProfile(candidate({
    candidate_id: "synthetic:generic-engineer",
    former_job_title: "Senior Software Engineer",
    function_name: "Engineering",
    public_description: "Senior frontend engineer building web applications and leading delivery.",
    public_skills: ["Frontend Development", "Web Applications"],
    seniority: "senior",
  })), role, job);

  const javaEngineer = scoreCandidate(buildCandidateProfile(candidate({
    candidate_id: "synthetic:java-engineer",
    former_job_title: "Software Engineer II",
    function_name: "Engineering",
    public_description: "Software engineer building Java backend services and APIs.",
    public_skills: ["Java", "Backend Development"],
    seniority: "mid",
  })), role, job);

  assertEqual(genericEngineer.technicalSkillEvidence, false, "Generic engineering evidence falsely satisfied Java requirement");
  assertEqual(javaEngineer.technicalSkillEvidence, true, "Direct Java evidence was not recognized");
  assert(javaEngineer.breakdown.skills.score > genericEngineer.breakdown.skills.score, "Direct Java evidence should improve skill score");
});

Deno.test("directory safety: scoring fixtures are synthetic and require no directory mutation", () => {
  const synthetic = candidate();
  assert(synthetic.candidate_id.startsWith("synthetic:"), "Test fixture must remain synthetic");
});
