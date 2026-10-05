import { CAPABILITY_UNITS, TECHNICAL_UNITS, qualificationSections, qualificationEvidence, qualificationNarrative } from "./qualification-evidence.ts";
import type {
  CachedRole,
  CacheLoadMetrics,
  CandidateCache,
  CandidateMatch,
  CandidateProfile,
  CandidatePreferenceRecord,
  JobProfile,
  PlacementCandidateCacheRow,
  Role,
  RolePreferenceRecord,
  TokenizedLabel,
} from "./types.ts";

export const CACHE_TTL_MS = 60 * 60 * 1000;
const DIRECTORY_URL = "https://irvinthev.github.io/Ex-GH-Layoff-Repo/people.json";

type DirectoryPerson = {
  "First Name"?: string;
  "Last Name"?: string;
  "Former Job Title"?: string;
  "Former Team"?: string;
  "Function"?: string;
  "Location"?: string;
  "LinkedIn URL"?: string;
  "Description"?: string;
  "Top 3 Skills"?: string;
  "Open to Work"?: string;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizeLinkedInIdentity(value: unknown): string | null {
  const raw = clean(value);
  if (!raw) return null;
  try {
    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(candidate);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "linkedin.com") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2 || parts[0].toLowerCase() !== "in") return null;
    const slug = parts[1].toLowerCase();
    if (!slug || slug === "me") return null;
    return `linkedin.com/in/${slug}`;
  } catch {
    return null;
  }
}

export function normalizeCandidateName(firstName: unknown, lastName: unknown): string {
  return `${clean(firstName)} ${clean(lastName)}`
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function directorySkills(value: unknown): string[] {
  return clean(value)
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    // The current directory export can place experience bands (for example
    // "9-12 years" or "12+ years") in the legacy Top 3 Skills field. Those are
    // profile metadata, not skills, and must not enter qualification scoring.
    .filter((item) => !/^\d+\s*(?:[-–]\s*\d+|\+)\s*years?$/i.test(item));
}

function directoryCandidateId(person: DirectoryPerson): string {
  const linkedIn = normalizeLinkedInIdentity(person["LinkedIn URL"]);
  if (linkedIn) return `directory:${linkedIn}`;
  return `directory:name:${normalizeCandidateName(person["First Name"], person["Last Name"]).replace(/\s+/g, "-")}`;
}

function directoryToCandidateRow(person: DirectoryPerson): PlacementCandidateCacheRow {
  const title = clean(person["Former Job Title"]) || null;
  return {
    candidate_id: directoryCandidateId(person),
    first_name: clean(person["First Name"]),
    last_name: clean(person["Last Name"]),
    former_job_title: title,
    former_team: clean(person["Former Team"]) || null,
    function_name: clean(person["Function"]) || null,
    location_text: clean(person["Location"]) || null,
    linkedin_url: normalizeLinkedInIdentity(person["LinkedIn URL"])
      ? clean(person["LinkedIn URL"])
      : null,
    public_description: clean(person["Description"]) || null,
    public_skills: directorySkills(person["Top 3 Skills"]),
    primary_role_slug: null,
    seniority: title ? inferSeniority(title, "") : null,
    skills: [],
    domains: [],
    evidence: {},
    role_preferences: [],
    candidate_preferences: null,
  };
}

export type NetworkReviewIssue = {
  severity: "high" | "medium" | "low";
  type: "identity_conflict" | "placement_only" | "name_fallback" | "invalid_linkedin" | "directory_duplicate";
  candidateName: string;
  message: string;
  suggestedAction: string;
};

function resolveDirectoryCandidates(
  directoryPeople: DirectoryPerson[],
  enrichedRows: PlacementCandidateCacheRow[],
): { rows: PlacementCandidateCacheRow[]; review: NetworkReviewIssue[] } {
  const enrichedByLinkedIn = new Map<string, PlacementCandidateCacheRow[]>();
  const enrichedByName = new Map<string, PlacementCandidateCacheRow[]>();

  for (const row of enrichedRows) {
    const linkedIn = normalizeLinkedInIdentity(row.linkedin_url);
    if (linkedIn) {
      const rows = enrichedByLinkedIn.get(linkedIn) ?? [];
      rows.push(row);
      enrichedByLinkedIn.set(linkedIn, rows);
    }
    const name = normalizeCandidateName(row.first_name, row.last_name);
    if (name) {
      const rows = enrichedByName.get(name) ?? [];
      rows.push(row);
      enrichedByName.set(name, rows);
    }
  }

  const usedEnrichedIds = new Set<string>();
  const seenDirectoryKeys = new Set<string>();
  const merged: PlacementCandidateCacheRow[] = [];
  const review: NetworkReviewIssue[] = [];

  for (const person of directoryPeople) {
    const base = directoryToCandidateRow(person);
    const rawLinkedIn = clean(person["LinkedIn URL"]);
    const linkedIn = normalizeLinkedInIdentity(rawLinkedIn);
    const name = normalizeCandidateName(person["First Name"], person["Last Name"]);
    const displayName = `${clean(person["First Name"])} ${clean(person["Last Name"])}`.trim();
    const directoryKey = linkedIn ? `li:${linkedIn}` : `name:${name}`;

    if (!name) continue;
    if (seenDirectoryKeys.has(directoryKey)) {
      review.push({
        severity: "high",
        type: "directory_duplicate",
        candidateName: displayName,
        message: "The public directory contains more than one record resolving to the same identity key.",
        suggestedAction: "Review the duplicate directory entries before relying on placement results.",
      });
      continue;
    }
    seenDirectoryKeys.add(directoryKey);

    const linkedInMatches = linkedIn
      ? (enrichedByLinkedIn.get(linkedIn) ?? []).filter((row) => !usedEnrichedIds.has(row.candidate_id))
      : [];
    const nameMatches = (enrichedByName.get(name) ?? []).filter((row) => !usedEnrichedIds.has(row.candidate_id));

    let enriched: PlacementCandidateCacheRow | null = null;
    let usedNameFallback = false;

    if (linkedInMatches.length === 1) {
      enriched = linkedInMatches[0];
    } else if (linkedInMatches.length > 1) {
      review.push({
        severity: "high",
        type: "identity_conflict",
        candidateName: displayName,
        message: "Multiple enriched profiles share this LinkedIn identity.",
        suggestedAction: "Resolve the duplicate enriched profiles before merging.",
      });
    } else if (nameMatches.length === 1) {
      const candidateLinkedIn = normalizeLinkedInIdentity(nameMatches[0].linkedin_url);
      const conflictingValidLinkedIns = Boolean(linkedIn && candidateLinkedIn && linkedIn !== candidateLinkedIn);
      if (conflictingValidLinkedIns) {
        review.push({
          severity: "high",
          type: "identity_conflict",
          candidateName: displayName,
          message: "First and last name match, but the directory and enriched profiles have different valid LinkedIn URLs.",
          suggestedAction: "Confirm the correct LinkedIn identity before merging these records.",
        });
      } else {
        enriched = nameMatches[0];
        usedNameFallback = true;
      }
    } else if (nameMatches.length > 1) {
      review.push({
        severity: "high",
        type: "identity_conflict",
        candidateName: displayName,
        message: "The name fallback matches more than one enriched profile.",
        suggestedAction: "Confirm the correct person and LinkedIn URL before merging.",
      });
    }

    if (!enriched) {
      merged.push(base);
      if (rawLinkedIn && !linkedIn) {
        review.push({
          severity: "low",
          type: "invalid_linkedin",
          candidateName: displayName,
          message: "The directory LinkedIn value is not a stable personal /in/ URL.",
          suggestedAction: "Replace it with the candidate's canonical LinkedIn profile URL.",
        });
      }
      continue;
    }

    usedEnrichedIds.add(enriched.candidate_id);
    merged.push({
      ...enriched,
      first_name: base.first_name || enriched.first_name,
      last_name: base.last_name || enriched.last_name,
      former_job_title: base.former_job_title || enriched.former_job_title,
      former_team: base.former_team || enriched.former_team,
      function_name: base.function_name || enriched.function_name,
      location_text: base.location_text || enriched.location_text,
      linkedin_url: linkedIn ? base.linkedin_url : enriched.linkedin_url,
      public_description: base.public_description || enriched.public_description,
      public_skills: base.public_skills?.length ? base.public_skills : enriched.public_skills,
      primary_role_slug: enriched.primary_role_slug,
      seniority: enriched.seniority || base.seniority,
      skills: enriched.skills,
      domains: enriched.domains,
      evidence: enriched.evidence,
      role_preferences: enriched.role_preferences,
      candidate_preferences: enriched.candidate_preferences,
    });

    if (usedNameFallback) {
      review.push({
        severity: "low",
        type: rawLinkedIn && !linkedIn ? "invalid_linkedin" : "name_fallback",
        candidateName: displayName,
        message: rawLinkedIn && !linkedIn
          ? "The directory LinkedIn value is invalid, so the profile was safely matched by unique first and last name."
          : "The directory and enriched profile were matched by unique first and last name because a LinkedIn identity was missing on one side.",
        suggestedAction: rawLinkedIn && !linkedIn
          ? "Replace the directory LinkedIn value with the canonical profile URL."
          : "Add the missing canonical LinkedIn URL when convenient.",
      });
    }
  }

  for (const row of enrichedRows) {
    if (usedEnrichedIds.has(row.candidate_id)) continue;
    merged.push(row);
    review.push({
      severity: "medium",
      type: "placement_only",
      candidateName: `${row.first_name} ${row.last_name}`.trim(),
      message: "An enriched Placement profile exists, but no public directory record currently resolves to it.",
      suggestedAction: "Confirm whether this person should complete the directory intake, was intentionally removed, or has already been placed.",
    });
  }

  const severityRank = { high: 0, medium: 1, low: 2 } as const;
  review.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.candidateName.localeCompare(b.candidateName));
  return { rows: merged, review };
}

export function mergeDirectoryCandidates(
  directoryPeople: DirectoryPerson[],
  enrichedRows: PlacementCandidateCacheRow[],
): PlacementCandidateCacheRow[] {
  return resolveDirectoryCandidates(directoryPeople, enrichedRows).rows;
}

export async function getNetworkReview(
  admin: { from: (table: string) => { select: (columns: string) => any } },
): Promise<{ issues: NetworkReviewIssue[]; directoryCount: number; enrichedCount: number; mergedCount: number }> {
  const [directoryPeople, candidatesResult] = await Promise.all([
    fetchDirectoryPeople(),
    admin.from("placement_candidate_cache").select("*"),
  ]);
  if (candidatesResult.error) throw candidatesResult.error;
  const enrichedRows = (candidatesResult.data ?? []) as PlacementCandidateCacheRow[];
  const resolution = resolveDirectoryCandidates(directoryPeople, enrichedRows);
  return {
    issues: resolution.review,
    directoryCount: directoryPeople.length,
    enrichedCount: enrichedRows.length,
    mergedCount: resolution.rows.length,
  };
}

async function fetchDirectoryPeople(): Promise<DirectoryPerson[]> {
  const response = await fetch(DIRECTORY_URL, {
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Directory load failed with HTTP ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload)) throw new Error("Directory payload was not an array");
  return payload as DirectoryPerson[];
}

const CONCEPT_GROUPS = [
  { label: "Implementation lifecycle", terms: ["implementation", "onboarding", "deployment", "rollout", "launch", "go live", "cutover", "adoption"] },
  { label: "Customer delivery", terms: ["customer delivery", "customer success", "client delivery", "client services", "customer implementation"] },
  { label: "Process and workflow design", terms: ["process improvement", "process optimization", "workflow transformation", "workflow design", "operating model", "scalable workflow"] },
  { label: "Data and integrations", terms: ["data migration", "data onboarding", "data flow", "data integration", "integration", "api", "webhook"] },
  { label: "Risk and escalations", terms: ["risk management", "implementation risk", "escalation", "issue resolution", "troubleshooting", "compliance"] },
  { label: "Cross-functional leadership", terms: ["cross functional", "stakeholder management", "multiple stakeholders", "partnering across", "executive update", "sales and engineering", "cross team collaboration"] },
  { label: "Automation", terms: ["automation", "automated", "scripting", "python"] },
  { label: "Data analysis and BI", terms: ["data analysis", "data analytics", "data analyst", "business intelligence", "sql", "dashboard", "reporting", "redash", "tableau", "power bi"] },
  { label: "Change and enablement", terms: ["change management", "enablement", "training", "organizational change"] },
  // Calibrated semantic groups. These intentionally map adjacent vocabulary to the
  // same underlying career evidence without changing the scoring weights.
  { label: "Product marketing and GTM", terms: ["product marketing", "go to market", "gtm", "positioning", "customer messaging", "sales enablement", "launch strategy", "market strategy"] },
  { label: "Education technology", terms: ["education technology", "edtech", "higher education", "learning technology", "learning platform", "learning management system", "lms", "university", "universities", "academic technology", "student experience", "educational software", "k12", "literacy platform", "instructional technology"] },
  { label: "Operations execution", terms: ["operations management", "site operations", "service operations", "field operations", "frontline operations", "fulfillment", "warehouse operations", "logistics", "logistics operations", "operational performance", "operational excellence", "capacity planning", "labor allocation", "labor planning", "workforce planning", "service level", "sla", "lean", "kaizen"] },
  { label: "Technical program delivery", terms: ["technical program manager", "technical program management", "technical program", "program management", "engineering program", "cross functional delivery", "technical delivery", "delivery management", "roadmap execution", "operating cadence"] },
  { label: "Software product delivery", terms: ["technical delivery", "software delivery", "software development lifecycle", "sdlc", "release management", "release planning", "product release", "agile", "scrum", "sprint planning", "product backlog", "backlog prioritization", "user stories", "acceptance criteria", "quality assurance", "qa", "defect management"] },
  { label: "Product strategy", terms: ["product strategy", "product roadmap", "roadmap", "product discovery", "product development", "product lifecycle", "user research"] },
  { label: "Platform and integrations", terms: ["platform strategy", "platform product", "systems integration", "api integration", "api strategy", "interoperability", "developer platform", "connectors"] },
  { label: "Fintech and payments", terms: ["fintech", "payments", "payment platform", "financial services", "lending", "invoicing", "digital wallet", "merchant payments"] },
  { label: "Finance systems", terms: ["finance systems", "financial systems", "erp transformation", "workday financials", "netsuite", "record to report", "procure to pay", "financial transformation"] },
  { label: "Strategic sourcing", terms: ["strategic sourcing", "sourcing strategy", "category sourcing", "supplier sourcing", "vendor sourcing", "rfp", "rfi", "rfq"] },
  { label: "Vendor management", terms: ["vendor management", "supplier management", "vendor relationship", "supplier relationship", "vendor governance", "supplier governance"] },
  { label: "Contracts and negotiation", terms: ["contract negotiation", "commercial negotiation", "msa", "master services agreement", "statement of work", "sow", "order form", "renewal negotiation"] },
  { label: "Procurement operations", terms: ["procure to pay", "procurement operations", "purchase order", "requisition", "supplier onboarding", "coupa", "zip"] },
  { label: "Technology spend optimization", terms: ["saas procurement", "software procurement", "license optimization", "software licensing", "spend analysis", "cost avoidance", "supplier consolidation", "vendor consolidation"] },
] as const;

const STOP_WORDS = new Set([
  "and", "the", "with", "for", "from", "that", "this", "you", "your", "our",
  "are", "will", "have", "has", "into", "who", "job", "role", "team", "work",
  "years", "experience", "skills", "using", "about", "their", "they", "but",
]);

const SENIORITY_RANK: Record<string, number> = {
  intern: 0,
  entry: 1,
  junior: 1,
  associate: 1,
  mid: 2,
  senior: 3,
  lead: 4,
  staff: 4,
  principal: 4,
  manager: 4,
  director: 5,
  executive: 6,
  vp: 6,
};


// Generic occupational/seniority words describe level or job class, not specialty.
// They must not independently create title similarity (e.g. Helpdesk Analyst vs Data Analyst).
const GENERIC_TITLE_TOKENS = new Set([
  "analyst", "analytic", "manager", "management", "specialist", "associate", "lead",
  "senior", "junior", "staff", "principal", "director", "engineer", "engineering",
  "developer", "development", "coordinator", "administrator", "consultant", "advisor",
  "officer", "head", "intern",
]);

let cachedCandidateData: CandidateCache | null = null;
let cacheLoadPromise: Promise<{ cache: CandidateCache; databaseQueryMs: number }> | null = null;

function roundMs(value: number): number {
  return Math.max(0, Math.round(value));
}

export function normalize(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\.(?=\s|$)/g, " ")
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stemWord(word: string): string {
  if (["analysis", "analytics", "analytical", "analyst", "analyze", "analyzing"].includes(word)) return "analytic";
  if (word.length > 5 && word.endsWith("sses")) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

export function tokens(value: unknown): string[] {
  const normalized = normalize(value);
  if (!normalized) return [];
  const unique = new Set<string>();
  for (const word of normalized.split(" ")) {
    if (word.length <= 2 || STOP_WORDS.has(word)) continue;
    unique.add(stemWord(word));
  }
  return [...unique];
}

export function titleSpecialtyTokens(value: unknown): string[] {
  return tokens(value).filter((token) => !GENERIC_TITLE_TOKENS.has(token));
}

export function includesPhrase(text: string, phrase: string): boolean {
  const cleanedText = normalize(text);
  const cleanedPhrase = normalize(phrase);
  if (cleanedPhrase.length <= 1 || !cleanedText) return false;

  // Match normalized whole phrases, not arbitrary substrings. This prevents
  // short skills such as "LTI" from matching unrelated words such as "multi".
  return ` ${cleanedText} `.includes(` ${cleanedPhrase} `);
}

export function overlapRatio(left: string[], right: string[]): number {
  if (!left.length || !right.length) return 0;
  const rightSet = new Set(right);
  let overlap = 0;
  for (const word of left) {
    if (rightSet.has(word)) overlap += 1;
  }
  return Math.min(1, overlap / Math.min(left.length, right.length));
}

export function conceptLabels(value: unknown): string[] {
  const text = normalize(value);
  if (!text) return [];
  return CONCEPT_GROUPS
    .filter((group) => group.terms.some((term) => includesPhrase(text, term)))
    .map((group) => group.label);
}

export function inferSeniority(title: string, description: string): string | null {
  const titleText = normalize(title);
  const bodyText = normalize(description).slice(0, 2000);
  const checks: Array<[string, RegExp]> = [
    ["executive", /\b(chief|cxo|president)\b/],
    ["vp", /\b(vp|vice president)\b/],
    ["director", /\b(director|head of)\b/],
    ["manager", /\b(manager|management)\b/],
    ["lead", /\b(lead|staff|principal)\b/],
    ["senior", /\b(senior|sr\.?|level 3|iii)\b/],
    ["mid", /\b(mid level|mid-level|level 2|ii)\b/],
    ["entry", /\b(junior|jr\.?|entry level|associate|level 1)\b/],
    ["intern", /\b(intern|internship)\b/],
  ];

  for (const [level, pattern] of checks) {
    if (pattern.test(titleText)) return level;
  }
  for (const [level, pattern] of checks) {
    if (pattern.test(bodyText)) return level;
  }
  return null;
}

function seniorityScore(candidate: string | null, target: string | null): { score: number; aligned: boolean } {
  if (!candidate || candidate === "unknown" || !target) return { score: 5, aligned: false };
  const candidateRank = SENIORITY_RANK[candidate];
  const targetRank = SENIORITY_RANK[target];
  if (candidateRank === undefined || targetRank === undefined) return { score: 5, aligned: false };
  const difference = Math.abs(candidateRank - targetRank);
  return { score: difference === 0 ? 10 : difference === 1 ? 7 : difference === 2 ? 3 : 0, aligned: difference <= 1 };
}

function locationScore(
  candidateLocations: string[],
  candidateLocationTokens: string[][],
  remotePreference: string | null,
  jobLocation: string,
  jobLocationTokens: string[],
  remoteType: string,
): { score: number; aligned: boolean; note: string } {
  const remote = normalize(`${remoteType} ${jobLocation}`).includes("remote");
  const remotePref = normalize(remotePreference);
  if (remote) {
    if (remotePref === "onsite") return { score: 6, aligned: false, note: "Remote role conflicts with recorded onsite preference" };
    return { score: 10, aligned: true, note: "Remote-compatible role" };
  }

  if (!jobLocation) return { score: 5, aligned: false, note: "Job location not supplied" };
  if (!candidateLocations.length) return { score: 5, aligned: false, note: "Candidate location not recorded" };

  const aligned = candidateLocationTokens.some((candidateTokens) => overlapRatio(candidateTokens, jobLocationTokens) > 0);
  if (aligned) return { score: 10, aligned: true, note: "Location appears aligned" };

  if (remotePref === "remote") return { score: 2, aligned: false, note: "Onsite/hybrid role conflicts with recorded remote preference" };
  return { score: 2, aligned: false, note: "Location needs review" };
}

function uniqueValues(values: Array<string | null | undefined>): string[] {
  const unique = new Set<string>();
  for (const value of values) {
    const trimmed = String(value ?? "").trim();
    if (trimmed) unique.add(trimmed);
  }
  return [...unique];
}

function coerceStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => String(entry ?? "").trim()).filter(Boolean)
    : [];
}

function coerceRolePreferenceArray(value: unknown): RolePreferenceRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const record = entry as Record<string, unknown>;
      return {
        role_slug: String(record.role_slug ?? "").trim(),
        preference: record.preference === "avoid" || record.preference === "target" || record.preference === "open"
          ? record.preference
          : "open",
        priority: typeof record.priority === "number" ? record.priority : null,
      } satisfies RolePreferenceRecord;
    })
    .filter((entry) => entry.role_slug);
}

function coerceCandidatePreference(value: unknown): CandidatePreferenceRecord {
  if (!value || typeof value !== "object") {
    return { target_titles: [], preferred_locations: [], remote_preference: null };
  }
  const record = value as Record<string, unknown>;
  return {
    target_titles: coerceStringArray(record.target_titles),
    preferred_locations: coerceStringArray(record.preferred_locations),
    remote_preference: record.remote_preference ? String(record.remote_preference) : null,
  };
}

function tokenizeLabel(raw: string): TokenizedLabel {
  const normalized = normalize(raw);
  return {
    raw,
    normalized,
    tokens: tokens(raw),
    concepts: conceptLabels(normalized),
  };
}

export function prepareRole(role: Role): CachedRole {
  const phrases = uniqueValues([role.role_family, role.specialty, ...(role.aliases ?? [])]);
  return {
    ...role,
    aliases: coerceStringArray(role.aliases),
    phrases,
    phraseTokens: tokens(phrases.join(" ")),
    normalizedFunctionName: normalize(role.function_name),
  };
}

export function buildCandidateProfile(row: PlacementCandidateCacheRow): CandidateProfile {
  const publicSkills = coerceStringArray(row.public_skills);
  const featureSkills = coerceStringArray(row.skills);
  const domains = coerceStringArray(row.domains);
  const enrichedEvidence = qualificationEvidence(row.evidence);
  const rolePreferences = new Map<string, RolePreferenceRecord>();
  for (const preference of coerceRolePreferenceArray(row.role_preferences)) {
    rolePreferences.set(preference.role_slug, preference);
  }
  const candidatePreference = coerceCandidatePreference(row.candidate_preferences);
  // Qualification scoring uses demonstrated/held titles only. Target titles are
  // candidate intent and must not increase qualification fit.
  const candidateTitles = uniqueValues([row.former_job_title]).map(tokenizeLabel);
  const allSkills = uniqueValues([...featureSkills, ...publicSkills]);
  const skillEntries = allSkills.map(tokenizeLabel);
  const domainEntries = domains.map(tokenizeLabel);
  const evidenceNormalized = normalize([
    row.former_job_title,
    row.former_team,
    row.public_description,
    ...publicSkills,
    ...featureSkills,
    ...enrichedEvidence,
  ].map((value) => qualificationNarrative(String(value ?? ""))).join(" "));
  const candidateConcepts = conceptLabels(evidenceNormalized);
  const preferredLocations = uniqueValues([row.location_text, ...candidatePreference.preferred_locations]);

  return {
    id: row.candidate_id,
    name: `${row.first_name} ${row.last_name}`.trim(),
    formerJobTitle: row.former_job_title,
    formerTeam: row.former_team,
    functionName: row.function_name,
    functionNameNormalized: normalize(row.function_name),
    location: row.location_text,
    locationTokens: tokens(row.location_text),
    linkedinUrl: row.linkedin_url,
    candidateRole: row.primary_role_slug,
    seniority: row.seniority,
    remotePreference: candidatePreference.remote_preference,
    preferredLocations,
    preferredLocationTokens: preferredLocations.map((location) => tokens(location)),
    rolePreferences,
    candidateTitles,
    publicDescription: row.public_description,
    publicSkills,
    enrichedSkills: featureSkills,
    enrichedEvidence,
    domains,
    hasEnrichedEvidence: featureSkills.length > 0 || domains.length > 0 || enrichedEvidence.length > 0,
    allSkills,
    skillEntries,
    domainEntries,
    evidenceNormalized,
    candidateConcepts,
    candidateConceptSet: new Set(candidateConcepts),
  };
}

export function prepareJobProfile(input: {
  title: string;
  description: string;
  location: string;
  remoteType: string;
}): JobProfile {
  const title = input.title.trim();
  const description = input.description.trim();
  const titleText = normalize(title);
  const sections = qualificationSections(description);
  const descriptionText = normalize(sections.core);
  const preferredText = normalize(sections.preferred);
  const jobText = normalize(`${title} ${description}`);
  // Qualification skills/concepts must come from the job description, not merely
  // from words in the job title. The title is still used for role classification.
  const concepts = conceptLabels(descriptionText);
  const coreRequirements = CAPABILITY_UNITS.filter((unit) => unit.terms.some((term) => includesPhrase(descriptionText, term)));
  const preferredRequirements = CAPABILITY_UNITS.filter((unit) => unit.terms.some((term) => includesPhrase(preferredText, term))
    && !coreRequirements.includes(unit));
  const technicalRequirementTerms = TECHNICAL_UNITS
    .filter((unit) => unit.terms.some((term) => includesPhrase(descriptionText, term)))
    .map((unit) => unit.label);
  const requiresTechnicalSkillEvidence = technicalRequirementTerms.length > 0;
  return {
    title,
    description,
    titleText,
    descriptionText,
    coreRequirements,
    preferredRequirements,
    titleTokens: tokens(title),
    jobText,
    jobTextTokens: tokens(jobText),
    concepts,
    conceptSet: new Set(concepts),
    seniority: inferSeniority(title, description),
    location: input.location.trim(),
    locationTokens: tokens(input.location),
    remoteType: input.remoteType.trim(),
    requiresTechnicalSkillEvidence,
    technicalRequirementTerms,
  };
}

export function classifyRole(job: JobProfile, roles: CachedRole[]): CachedRole | null {
  let best: { role: CachedRole; points: number } | null = null;
  const bodyText = job.descriptionText.slice(0, 6000);

  for (const role of roles) {
    let points = 0;
    for (const phrase of role.phrases) {
      if (includesPhrase(job.titleText, phrase)) points += 8;
      if (includesPhrase(bodyText, phrase)) points += 2;
    }
    points += overlapRatio(job.titleTokens, role.phraseTokens) * 5;
    if (!best || points > best.points) best = { role, points };
  }

  return best && best.points >= 2 ? best.role : null;
}

export function scoreCandidate(candidate: CandidateProfile, role: CachedRole | null, job: JobProfile): CandidateMatch {
  // Capability evidence intentionally excludes the held title. Title has its own
  // scoring component and must not independently manufacture role-family or skill credit.
  const capabilityEvidenceNormalized = normalize([
    candidate.formerTeam,
    candidate.publicDescription,
    ...candidate.publicSkills,
    ...candidate.enrichedSkills,
    ...candidate.enrichedEvidence,
  ].map((value) => qualificationNarrative(String(value ?? ""))).join(" "));
  const capabilityEvidenceTokens = tokens(capabilityEvidenceNormalized);

  const exactEvidenceRoleMatch = role
    ? role.phrases.some((phrase) => includesPhrase(capabilityEvidenceNormalized, phrase))
    : false;
  const semanticEvidenceRoleMatch = role
    ? role.phrases.some((phrase) => {
        const phraseTokens = tokens(phrase);
        return phraseTokens.length >= 2 && overlapRatio(phraseTokens, capabilityEvidenceTokens) >= 0.75;
      })
    : false;

  const jobTitleSpecialtyTokens = titleSpecialtyTokens(job.title);
  const bestTitleRatio = candidate.candidateTitles.reduce((best, candidateTitle) => {
    const candidateTitleSpecialtyTokens = titleSpecialtyTokens(candidateTitle.raw);
    if (!candidateTitleSpecialtyTokens.length || !jobTitleSpecialtyTokens.length) return best;
    return Math.max(best, overlapRatio(candidateTitleSpecialtyTokens, jobTitleSpecialtyTokens));
  }, 0);

  const titleScore = bestTitleRatio >= 0.95
    ? 15
    : bestTitleRatio >= 0.75
      ? 13
      : bestTitleRatio >= 0.5
        ? 10
        : bestTitleRatio >= 0.34
          ? 6
          : Math.round(bestTitleRatio * 15);

  const evidenced = (unit: { terms: readonly string[] }) =>
    unit.terms.some((term) => includesPhrase(capabilityEvidenceNormalized, term));
  const matchedCore = job.coreRequirements.filter(evidenced);
  const matchedPreferred = job.preferredRequirements.filter(evidenced);
  const matchedTechnicalRequirements = TECHNICAL_UNITS
    .filter((unit) => job.technicalRequirementTerms.includes(unit.label) && evidenced(unit))
    .map((unit) => unit.label);

  const contextualSkillEntries = candidate.skillEntries.filter((skill) => (
    !CAPABILITY_UNITS.some((unit) => unit.terms.some((term) => includesPhrase(skill.normalized, term)))
    && includesPhrase(job.descriptionText, skill.normalized)
  ));
  // Transferable concepts must come from capability evidence, not the held title.
  // This closes an indirect title -> role-family path for titles such as Data Analyst.
  const capabilityConceptSet = new Set(conceptLabels(capabilityEvidenceNormalized));
  const matchedConcepts = job.concepts.filter((label) => capabilityConceptSet.has(label));
  const coreSkillPoints = Math.min(20, matchedCore.length * 6);
  const contextualSkillPoints = Math.min(2, new Set(contextualSkillEntries.map((skill) => skill.normalized)).size);
  const skillScore = Math.min(20, coreSkillPoints + contextualSkillPoints);

  const capabilityEvidenceMatch = matchedCore.length > 0 && (
    semanticEvidenceRoleMatch || matchedCore.length >= 2 || matchedConcepts.length >= 1
  );
  const evidenceRoleMatch = exactEvidenceRoleMatch || capabilityEvidenceMatch;

  // Role-family and title are intentionally independent. A matching held title
  // cannot also award role-family points by itself.
  const roleScore = role && exactEvidenceRoleMatch && matchedCore.length >= 2
    ? 30
    : role && evidenceRoleMatch
      ? 24
      : role && candidate.functionNameNormalized === role.normalizedFunctionName
        ? 18
        : 0;

  const matchedDomains = [...new Map(candidate.domainEntries.filter((domain) => (
    includesPhrase(job.descriptionText, domain.normalized)
  )).map((domain) => [domain.normalized, domain.raw])).values()];
  const domainScore = Math.min(15, matchedDomains.length * 4);

  const seniority = seniorityScore(candidate.seniority, job.seniority);
  const geography = locationScore(
    candidate.preferredLocations,
    candidate.preferredLocationTokens,
    candidate.remotePreference,
    job.location,
    job.locationTokens,
    job.remoteType,
  );

  const capabilityRaw = roleScore + titleScore + skillScore + domainScore;
  const capabilityScore = Math.round((capabilityRaw / 80) * 100);

  const evidenceSources = [
    { source: "directory_description" as const, evidence: candidate.publicDescription ?? "" },
    ...candidate.publicSkills.map((evidence) => ({ source: "public_skill" as const, evidence })),
    ...candidate.enrichedSkills.map((evidence) => ({ source: "enriched_skill" as const, evidence })),
    ...candidate.enrichedEvidence.map((evidence) => ({ source: "enriched_evidence" as const, evidence })),
    { source: "directory_team" as const, evidence: candidate.formerTeam ?? "" },
  ].filter((entry) => entry.evidence.trim());

  const traceForUnit = (unit: { label: string; terms: readonly string[] }) => {
    const source = evidenceSources.find((entry) =>
      unit.terms.some((term) => includesPhrase(entry.evidence, term))
    );
    return source
      ? { capability: unit.label, source: source.source, evidence: source.evidence }
      : null;
  };

  const evidenceTrace: CandidateMatch["evidenceTrace"] = matchedCore
    .map(traceForUnit)
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  if (titleScore > 0 && candidate.formerJobTitle) {
    evidenceTrace.push({
      capability: "Title alignment",
      source: "held_title",
      evidence: candidate.formerJobTitle,
    });
  }

  if (role && roleScore >= 24) {
    const roleSource = evidenceSources.find((entry) =>
      role.phrases.some((phrase) => includesPhrase(entry.evidence, phrase))
    );
    if (roleSource) {
      evidenceTrace.push({
        capability: `Role family: ${role.role_family}`,
        source: roleSource.source,
        evidence: roleSource.evidence,
      });
    }
  }

  const reasons: string[] = [];
  if (roleScore === 30 && role) reasons.push(`Direct experience and capability evidence strongly support ${role.role_family}`);
  else if (roleScore === 24 && role) reasons.push(`Experience evidence supports ${role.role_family}`);
  else if (roleScore === 18 && role) reasons.push(`Related ${role.function_name} function`);
  if (titleScore >= 13) reasons.push("Held job title strongly aligns with the role");
  else if (titleScore >= 10) reasons.push("Held job title aligns with the role");
  if (matchedCore.length) reasons.push(`Core capabilities evidenced: ${matchedCore.map((unit) => unit.label).join(", ")}`);
  if (matchedPreferred.length) reasons.push(`Preferred capabilities evidenced (not core points): ${matchedPreferred.map((unit) => unit.label).join(", ")}`);
  if (contextualSkillEntries.length) reasons.push(`Contextual overlap: ${contextualSkillEntries.slice(0, 2).map((skill) => skill.raw).join(", ")}`);
  if (matchedTechnicalRequirements.length) reasons.push(`Technical requirement evidence: ${matchedTechnicalRequirements.slice(0, 3).join(", ")}`);
  if (matchedConcepts.length) reasons.push(`Transferable context: ${matchedConcepts.slice(0, 4).join(", ")}`);
  if (matchedDomains.length) reasons.push(`Relevant domain evidence: ${matchedDomains.slice(0, 2).join(", ")}`);
  if (seniority.score === 10) reasons.push("Seniority appears aligned");
  else if (seniority.score === 7) reasons.push("Seniority is adjacent to the role level");
  if (geography.aligned) reasons.push(geography.note);

  const gaps: string[] = [];
  if (!role && titleScore === 0) gaps.push("Role family could not be classified confidently");
  else if (roleScore === 0 && role) gaps.push(`No direct evidence for ${role.role_family}`);
  else if (roleScore < 24 && role) gaps.push(`Recorded capability evidence is adjacent to, rather than directly within, ${role.role_family}`);
  if (skillScore < 12) gaps.push("Limited responsibility and skill overlap found in the recorded evidence");
  else if (skillScore < 18) gaps.push("Some job responsibilities are not demonstrated explicitly in the recorded evidence");
  const missingConcepts = job.concepts.filter((label) => !candidate.candidateConceptSet.has(label));
  if (missingConcepts.length) gaps.push(`Validate: ${missingConcepts.slice(0, 3).join(", ")}`);
  if (job.seniority && !seniority.aligned) gaps.push("Validate role level: capability may fit, but seniority is not aligned");
  if (!geography.aligned) gaps.push(`Validate location/work model: ${geography.note}`);

  return {
    candidate: {
      id: candidate.id,
      name: candidate.name,
      formerJobTitle: candidate.formerJobTitle,
      functionName: candidate.functionName,
      location: candidate.location,
      linkedinUrl: candidate.linkedinUrl,
      skills: candidate.allSkills,
    },
    score: capabilityScore,
    fitBand: capabilityScore >= 75 ? "Strong" : capabilityScore >= 55 ? "Possible" : "Exploratory",
    technicalSkillEvidence: matchedTechnicalRequirements.length > 0,
    coreCoverage: {
      recognized: job.coreRequirements.map((unit) => unit.label),
      evidenced: matchedCore.map((unit) => unit.label),
      notEvidenced: job.coreRequirements.filter((unit) => !matchedCore.includes(unit)).map((unit) => unit.label),
      ratio: job.coreRequirements.length ? matchedCore.length / job.coreRequirements.length : null,
      preferredEvidenced: matchedPreferred.map((unit) => unit.label),
    },
    evidenceTrace,
    breakdown: {
      roleFamily: { score: roleScore, max: 30 },
      titleSpecialty: { score: titleScore, max: 15 },
      skills: { score: skillScore, max: 20 },
      domain: { score: domainScore, max: 15 },
      seniority: { score: seniority.score, max: 10 },
      location: { score: geography.score, max: 10 },
    },
    reasons,
    gaps,
  };
}

function buildCandidateCache(rows: PlacementCandidateCacheRow[], roles: Role[], now: number): CandidateCache {
  const preparedRoles = roles.map(prepareRole);
  const candidates = rows.map(buildCandidateProfile);
  return {
    roles: preparedRoles,
    candidates,
    loadedAt: new Date(now).toISOString(),
    expiresAt: now + CACHE_TTL_MS,
    candidateCount: candidates.length,
  };
}

async function refreshCandidateCache(
  admin: { from: (table: string) => { select: (columns: string) => any } },
  now: number,
): Promise<{ cache: CandidateCache; databaseQueryMs: number }> {
  const queryStartedAt = performance.now();
  const [rolesResult, candidatesResult, directoryPeople] = await Promise.all([
    admin.from("role_taxonomy").select("slug,function_name,role_family,specialty,aliases").eq("active", true),
    admin.from("placement_candidate_cache").select("*"),
    fetchDirectoryPeople(),
  ]);
  const databaseQueryMs = roundMs(performance.now() - queryStartedAt);
  if (rolesResult.error) throw rolesResult.error;
  if (candidatesResult.error) throw candidatesResult.error;
  const mergedRows = mergeDirectoryCandidates(
    directoryPeople,
    (candidatesResult.data ?? []) as PlacementCandidateCacheRow[],
  );
  const cache = buildCandidateCache(
    mergedRows,
    (rolesResult.data ?? []) as Role[],
    now,
  );
  return { cache, databaseQueryMs };
}

export async function getCandidateCache(
  admin: { from: (table: string) => { select: (columns: string) => any } },
  now = Date.now(),
): Promise<{ cache: CandidateCache; metrics: CacheLoadMetrics }> {
  const loadStartedAt = performance.now();
  if (cachedCandidateData && now < cachedCandidateData.expiresAt) {
    return {
      cache: cachedCandidateData,
      metrics: {
        cacheStatus: "hit",
        loadMs: roundMs(performance.now() - loadStartedAt),
        databaseQueryMs: 0,
        loadedAt: cachedCandidateData.loadedAt,
        candidateCount: cachedCandidateData.candidateCount,
      },
    };
  }

  const initiatedRefresh = !cacheLoadPromise;
  if (!cacheLoadPromise) {
    cacheLoadPromise = refreshCandidateCache(admin, now)
      .then((result) => {
        cachedCandidateData = result.cache;
        return result;
      })
      .finally(() => {
        cacheLoadPromise = null;
      });
  }

  const { cache, databaseQueryMs } = await cacheLoadPromise;
  return {
    cache,
    metrics: {
      cacheStatus: initiatedRefresh ? "refresh" : "hit",
      loadMs: roundMs(performance.now() - loadStartedAt),
      databaseQueryMs: initiatedRefresh ? databaseQueryMs : 0,
      loadedAt: cache.loadedAt,
      candidateCount: cache.candidateCount,
    },
  };
}

export function resetCandidateCacheForTests(): void {
  cachedCandidateData = null;
  cacheLoadPromise = null;
}
