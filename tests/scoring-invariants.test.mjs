import test from "node:test";
import assert from "node:assert/strict";
import { buildCandidateProfile, classifyRole, includesPhrase, normalize, prepareJobProfile, prepareRole, scoreCandidate, tokens } from "../supabase/functions/evaluate-job/candidate-cache.ts";
import { attachEvidenceLayers } from "../supabase/functions/evaluate-job/evidence-layers.ts";
import { extractJobPostingHtml } from "../supabase/functions/evaluate-job/job-import.ts";

// Run the existing Deno-compatible pure-function suites in the Node test gate.
globalThis.Deno = { test };
await import("../supabase/functions/evaluate-job/scoring-invariants.test.ts");
await import("../supabase/functions/evaluate-job/job-import.test.ts");

const role = prepareRole({ slug: "data_analytics", function_name: "Data & Analytics", role_family: "Data Analytics", specialty: null, aliases: ["data analyst"] });
const description = `About Us
Education and mission-driven technology serving customers.
Key Responsibilities
Use SQL for data analysis. Build dashboards and recurring reports.
Background & Experience
Use Excel or Google Sheets. Check data quality. Document queries and data definitions. Communicate findings.
Preferred
Tableau and Python experience.
Benefits
Education technology benefits and customer support programs.`;
const job = prepareJobProfile({ title: "Junior Data Analyst", description, location: "Remote", remoteType: "Remote" });
function row(overrides = {}) {
  return { candidate_id: "synthetic:operator", first_name: "Synthetic", last_name: "Operator", former_job_title: "Senior Lead Associate", former_team: "Operations", function_name: "Operations", location_text: "Chicago", linkedin_url: null, public_description: "Built SQL queries and metrics dashboards in Redash for operational analysis.", public_skills: ["SQL Querying", "Data Analysis", "Dashboard Building"], primary_role_slug: null, seniority: "lead", skills: [], domains: [], evidence: {}, role_preferences: [], candidate_preferences: null, ...overrides };
}
const score = (overrides, target = job) => scoreCandidate(buildCandidateProfile(row(overrides)), role, target);

test("sentence punctuation cannot hide skills or break dotted technology names", () => {
  for (const term of ["sql", "node.js", ".net"]) assert.ok(includesPhrase(normalize(`Experience with ${term}.`), term));
});

test("HTML headings preserve core/preferred boundaries", () => {
  const html = '<h2>Requirements</h2><p>Use SQL to produce regular reporting and dashboards for operational teams.</p><h2>Preferred</h2><p>Python experience is welcome.</p>';
  const imported = extractJobPostingHtml(`<script type="application/ld+json">${JSON.stringify({ "@type": "JobPosting", title: "Data Analyst", description: html })}</script>`, "https://jobs.example.com/1");
  const target = prepareJobProfile(imported);
  assert.deepEqual(target.technicalRequirementTerms, ["sql"]);
  assert.ok(target.preferredRequirements.some((unit) => unit.label === "python"));
});

test("distinct JD units, not label or evidence-layer breadth, determine core points", () => {
  const base = score({});
  const duplicate = score({ skills: ["SQL", "Data Analytics", "Analytics", "Reporting", "Dashboards"], evidence: { summary: "SQL data analysis reporting dashboards", verified_signals: ["Built dashboards with SQL"] } });
  assert.equal(base.score, duplicate.score);
  assert.deepEqual(base.coreCoverage, duplicate.coreCoverage);
  assert.equal(base.breakdown.skills.score, 18);
  const narrativeOnly = score({ public_skills: [] });
  assert.equal(narrativeOnly.score, base.score);
});

test("a technical match cannot promote contextual skills to core", () => {
  const target = prepareJobProfile({ title: "Data Analyst", description: "Use SQL and support operations and customer delivery.", location: "", remoteType: "" });
  const result = score({ public_description: "SQL specialist", public_skills: ["SQL", "Operations", "Customer Delivery"] }, target);
  assert.deepEqual(result.coreCoverage.evidenced, ["sql"]);
  assert.equal(result.breakdown.skills.score, 8);
});

test("preferred skills and boilerplate remain outside core qualification points", () => {
  const base = score({});
  const rich = score({ skills: ["Python", "Tableau"], domains: ["Education Technology", "Mission-Driven Technology", "Customer Support"] });
  assert.equal(rich.score, base.score);
  assert.deepEqual(rich.coreCoverage.preferredEvidenced, ["python", "tableau"]);
  assert.equal(rich.breakdown.domain.score, 0);
  assert.deepEqual(job.technicalRequirementTerms, ["sql"]);
});

test("dispersed domain words and duplicated domain labels do not manufacture points", () => {
  const target = prepareJobProfile({ title: "Data Analyst", description: "Use SQL in education settings and build technology for operations.", location: "", remoteType: "" });
  assert.equal(score({ domains: ["Education Technology"] }, target).breakdown.domain.score, 0);
  assert.equal(score({ domains: ["Operations", "operations", " Operations "] }, target).breakdown.domain.score, 4);
});

test("two incidental skills and generic concepts cannot establish an analytics role", () => {
  const target = prepareJobProfile({ title: "Data Analyst", description: "Support operations and customer delivery with SQL.", location: "", remoteType: "" });
  const result = score({ public_description: "Customer delivery and operations", public_skills: ["Operations", "Customer Delivery"] }, target);
  assert.equal(result.breakdown.roleFamily.score, 0);
});

test("intent in JSON keys, metadata values and explicit narrative cannot score", () => {
  const sparse = { public_description: "Operations associate", public_skills: [] };
  const base = score(sparse);
  const result = score({ ...sparse, public_description: "Operations associate. Targeting Data Analyst roles using SQL and Python.", evidence: { sql: true, source_file: "sql-data-analyst.pdf", motivators: ["SQL data analyst"], best_fit_patterns: ["Data Analytics"], target_titles: ["Data Analyst"], unrelated: { summary: "SQL dashboards" } } });
  assert.equal(result.score, base.score);
  assert.equal(result.technicalSkillEvidence, false);
});

test("approved resume evidence resolves real skills while evidence depth remains metadata", () => {
  const plainProfile = buildCandidateProfile(row({
    candidate_id: "synthetic:plain",
    public_description: "Built SQL queries and metrics dashboards in Redash for operational analysis.",
    public_skills: ["SQL Querying", "Data Analysis", "Dashboard Building"],
    skills: [],
    domains: [],
    evidence: {},
  }));
  const enrichedProfile = buildCandidateProfile(row({
    candidate_id: "synthetic:rich",
    public_description: "Built SQL queries and metrics dashboards in Redash for operational analysis.",
    public_skills: ["SQL Querying", "Data Analysis", "Dashboard Building"],
    skills: [],
    domains: [],
    evidence: { resume: { technical_skills: ["SQL"], verified_signals: ["Built dashboards for data analysis"] } },
  }));
  const plainResult = scoreCandidate(plainProfile, role, job);
  const richResult = scoreCandidate(enrichedProfile, role, job);

  assert.equal(plainResult.score, richResult.score);
  const [plain, rich] = attachEvidenceLayers(
    [plainResult, richResult],
    [plainProfile, enrichedProfile],
    { requiresTechnicalSkillEvidence: true },
  );
  assert.equal(plain.score, rich.score);
  assert.equal(plain.fitBand, rich.fitBand);
  assert.equal(plain.evidenceConfidence.layers.l3, false);
  assert.equal(rich.evidenceConfidence.layers.l3, true);
});

test("validation changes do not alter score, coverage or band", () => {
  const baseline = score({});
  const changed = score({ seniority: "entry", location_text: "Far away", candidate_preferences: { target_titles: ["Data Analyst"], preferred_locations: [], remote_preference: "onsite" } });
  assert.equal(changed.score, baseline.score);
  assert.equal(changed.fitBand, baseline.fitBand);
  assert.deepEqual(changed.coreCoverage, baseline.coreCoverage);
});

test("direct reports are people-management evidence, not report-building evidence", () => {
  const result = score({ public_description: "Managed 25 direct reports", public_skills: [] });
  assert.deepEqual(result.coreCoverage.evidenced, []);
});

test("coverage is explicitly unknown when no recognized requirements exist", () => {
  const target = prepareJobProfile({ title: "Coordinator", description: "Coordinate schedules and support the team with daily administrative work.", location: "", remoteType: "" });
  assert.equal(score({}, target).coreCoverage.ratio, null);
  assert.equal(target.requirementsParsed, false);
});

test("common qualification headings resume parsing after context sections", () => {
  const minimumQualifications = prepareJobProfile({
    title: "Data Analyst",
    description: "About Us\nWe build tools for customers.\nMinimum Qualifications\nUse SQL to analyze data.",
    location: "",
    remoteType: "",
  });
  const whoYouAre = prepareJobProfile({
    title: "Data Analyst",
    description: "Benefits\nHealth coverage and paid leave.\nWho You Are\nBuild dashboards and recurring reports.",
    location: "",
    remoteType: "",
  });

  assert.equal(minimumQualifications.requirementsParsed, true);
  assert.deepEqual(minimumQualifications.coreRequirements.map((unit) => unit.label), ["sql", "Data analysis"]);
  assert.equal(whoYouAre.requirementsParsed, true);
  assert.deepEqual(whoYouAre.coreRequirements.map((unit) => unit.label), ["Reporting and dashboards"]);

  for (const heading of [
    "Basic Qualifications",
    "What We're Looking For",
    "What We’re Looking For",
    "What You Will Do",
    "Your Impact",
  ]) {
    const target = prepareJobProfile({
      title: "Data Analyst",
      description: `About Us\nCompany information.\n${heading}\nUse SQL for data analysis.`,
      location: "",
      remoteType: "",
    });
    assert.equal(target.requirementsParsed, true, `${heading} should resume core parsing`);
  }
});

test("only approved two-character occupational tokens survive tokenization", () => {
  assert.deepEqual(tokens("AI it HR Ux qA bi Pm are is in at zz"), ["ai", "it", "hr", "ux", "qa", "bi", "pm"]);
});

test("abbreviated and generic-manager job titles classify from specific role terms", () => {
  const titles = [
    "AI Product Manager",
    "IT Audit Manager",
    "HR Manager",
    "UX Researcher",
    "QA Manager",
    "BI Analyst",
    "Marketing Manager",
    "Operations Manager",
    "Customer Success Manager",
    "Product Manager",
  ];
  const roles = titles.map((title, index) => prepareRole({
    slug: `role-${index}`,
    function_name: title,
    role_family: title,
    specialty: null,
    aliases: [title],
  }));

  for (const [index, title] of titles.entries()) {
    const job = prepareJobProfile({ title, description: "", location: "", remoteType: "" });
    assert.equal(classifyRole(job, roles)?.slug, `role-${index}`, `${title} should classify to its specific role`);
  }
});

test("generic manager and seniority overlap alone cannot determine a role family", () => {
  const managerRole = prepareRole({
    slug: "generic-manager",
    function_name: "Management",
    role_family: "Manager",
    specialty: null,
    aliases: ["Senior Manager", "Lead Manager"],
  });
  const job = prepareJobProfile({
    title: "Marketing Manager",
    description: "We are hiring a senior manager.",
    location: "",
    remoteType: "",
  });

  assert.equal(classifyRole(job, [managerRole]), null);
});

test("import to ranking preserves section boundaries and the five evidence patterns", () => {
  const html = `<html><head><title>Junior Data Analyst</title></head><body><div class="show-more-less-html__markup">${description.split("\n").map((line) => `<p>${line}</p>`).join("")}</div><section>Recommended jobs: Education Technology</section></body></html>`;
  const imported = prepareJobProfile(extractJobPostingHtml(html, "https://www.linkedin.com/jobs/view/123/"));
  const profiles = [
    ["operator", {}],
    ["scientist", { public_description: "Decision scientist", public_skills: ["Data Analysis", "Analytics"], evidence: { resume: { technical_skills: ["SQL", "Python"] } }, domains: ["Education Technology"] }],
    ["manager", { public_description: "Managed direct reports", public_skills: ["SQL", "Tableau", "Advanced Excel"] }],
    ["onboarding", { public_description: "Operations leader", public_skills: ["SQL", "Python"] }],
    ["analytics_support", { public_description: "Built dashboards", public_skills: ["SQL", "Data Analysis", "Excel", "Python", "Tableau"] }],
  ];
  const ranked = profiles.map(([name, changes]) => ({ name, ...score(changes, imported) })).sort((a, b) => b.score - a.score);
  const byName = new Map(ranked.map((result) => [result.name, result]));
  assert.ok(byName.get("analytics_support").score > byName.get("onboarding").score);
  assert.ok(byName.get("operator").coreCoverage.evidenced.length >= 2);
  assert.ok(byName.get("scientist").evidenceTrace.some((entry) => entry.source === "enriched_evidence"));
  assert.equal(byName.get("manager").coreCoverage.preferredEvidenced.includes("tableau"), true);
});
