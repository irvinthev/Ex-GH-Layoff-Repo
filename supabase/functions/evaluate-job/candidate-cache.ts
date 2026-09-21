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

const CONCEPT_GROUPS = [
  { label: "Implementation lifecycle", terms: ["implementation", "onboarding", "deployment", "rollout", "launch", "go live", "cutover", "adoption"] },
  { label: "Customer delivery", terms: ["customer delivery", "customer success", "client delivery", "client services", "customer implementation"] },
  { label: "Process and workflow design", terms: ["process improvement", "process optimization", "workflow transformation", "workflow design", "operating model", "scalable workflow"] },
  { label: "Data and integrations", terms: ["data migration", "data onboarding", "data flow", "data integration", "integration", "api", "webhook"] },
  { label: "Risk and escalations", terms: ["risk management", "implementation risk", "escalation", "issue resolution", "troubleshooting", "compliance"] },
  { label: "Cross-functional leadership", terms: ["cross functional", "stakeholder management", "multiple stakeholders", "partnering across", "executive update", "sales and engineering", "cross team collaboration"] },
  { label: "Automation", terms: ["automation", "automated", "scripting", "python"] },
  { label: "Change and enablement", terms: ["change management", "enablement", "training", "organizational change"] },
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

let cachedCandidateData: CandidateCache | null = null;
let cacheLoadPromise: Promise<{ cache: CandidateCache; databaseQueryMs: number }> | null = null;

function roundMs(value: number): number {
  return Math.max(0, Math.round(value));
}

export function normalize(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stemWord(word: string): string {
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

export function includesPhrase(text: string, phrase: string): boolean {
  const cleaned = normalize(phrase);
  return cleaned.length > 1 && text.includes(cleaned);
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
  const rolePreferences = new Map<string, RolePreferenceRecord>();
  for (const preference of coerceRolePreferenceArray(row.role_preferences)) {
    rolePreferences.set(preference.role_slug, preference);
  }
  const candidatePreference = coerceCandidatePreference(row.candidate_preferences);
  const candidateTitles = uniqueValues([row.former_job_title, ...candidatePreference.target_titles]).map(tokenizeLabel);
  const allSkills = uniqueValues([...featureSkills, ...publicSkills]);
  const skillEntries = allSkills.map(tokenizeLabel);
  const domainEntries = domains.map(tokenizeLabel);
  const evidenceNormalized = normalize([
    row.former_job_title,
    row.former_team,
    row.public_description,
    ...publicSkills,
    ...featureSkills,
    ...domains,
    JSON.stringify(row.evidence ?? {}),
  ].join(" "));
  const candidateConcepts = conceptLabels(evidenceNormalized);
  const preferredLocations = uniqueValues([row.location_text, ...candidatePreference.preferred_locations]);

  return {
    id: row.candidate_id,
    name: `${row.first_name} ${row.last_name}`.trim(),
    formerJobTitle: row.former_job_title,
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
  const descriptionText = normalize(description);
  const jobText = normalize(`${title} ${description}`);
  const concepts = conceptLabels(jobText);
  return {
    title,
    description,
    titleText,
    descriptionText,
    titleTokens: tokens(title),
    jobText,
    jobTextTokens: tokens(jobText),
    concepts,
    conceptSet: new Set(concepts),
    seniority: inferSeniority(title, description),
    location: input.location.trim(),
    locationTokens: tokens(input.location),
    remoteType: input.remoteType.trim(),
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
  const rolePreference = role ? candidate.rolePreferences.get(role.slug) ?? null : null;
  const targetPreference = rolePreference && rolePreference.preference !== "avoid" ? rolePreference : null;
  const avoidedRole = rolePreference?.preference === "avoid";
  const evidenceRoleMatch = role ? role.phrases.some((phrase) => includesPhrase(candidate.evidenceNormalized, phrase)) : false;
  const bestTitleRatio = candidate.candidateTitles.reduce(
    (best, candidateTitle) => Math.max(best, overlapRatio(candidateTitle.tokens, job.titleTokens)),
    0,
  );
  const preferredTitleMatch = bestTitleRatio >= 0.5;

  const roleScore = avoidedRole
    ? 0
    : role && candidate.candidateRole === role.slug
      ? 30
      : preferredTitleMatch && bestTitleRatio >= 0.75
        ? 27
        : preferredTitleMatch
          ? 24
          : role && targetPreference && evidenceRoleMatch
            ? 28
            : role && evidenceRoleMatch
              ? 24
              : role && candidate.functionNameNormalized === role.normalizedFunctionName
                ? 18
                : role && targetPreference
                  ? 12
                  : 0;

  const titleScore = bestTitleRatio >= 0.95
    ? 15
    : bestTitleRatio >= 0.75
      ? 13
      : bestTitleRatio >= 0.5
        ? 10
        : bestTitleRatio >= 0.34
          ? 6
          : Math.round(bestTitleRatio * 15);

  const matchedSkills = candidate.skillEntries.filter((skill) => (
    includesPhrase(job.jobText, skill.normalized) || overlapRatio(skill.tokens, job.jobTextTokens) >= 0.67
  )).map((skill) => skill.raw);
  const matchedConcepts = job.concepts.filter((label) => candidate.candidateConceptSet.has(label));
  const conceptCoverage = job.concepts.length ? matchedConcepts.length / job.concepts.length : 0;
  const skillScore = Math.min(20, Math.min(6, matchedSkills.length * 2) + Math.round(conceptCoverage * 14));

  const matchedDomains = candidate.domainEntries.filter((domain) => (
    includesPhrase(job.jobText, domain.normalized)
    || overlapRatio(domain.tokens, job.jobTextTokens) >= 0.67
    || domain.concepts.some((label) => job.conceptSet.has(label))
  )).map((domain) => domain.raw);
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
  const total = roleScore + titleScore + skillScore + domainScore + seniority.score + geography.score;

  const reasons: string[] = [];
  if (roleScore === 30 && role) reasons.push(`Direct ${role.role_family} role-family match`);
  else if (roleScore === 28 && role) reasons.push(`Target ${role.role_family} role supported by experience evidence`);
  else if (roleScore === 27) reasons.push("Job title strongly aligns with a candidate target title");
  else if (roleScore === 24 && preferredTitleMatch) reasons.push("Job title aligns with a candidate target title");
  else if (roleScore === 24 && role) reasons.push(`Experience evidence supports ${role.role_family}`);
  else if (roleScore === 18 && role) reasons.push(`Related ${role.function_name} function`);
  else if (roleScore === 12 && role) reasons.push(`Candidate is open to ${role.role_family}; qualification evidence is limited`);
  if (matchedSkills.length) reasons.push(`Skills named in role: ${matchedSkills.slice(0, 3).join(", ")}`);
  if (matchedConcepts.length) reasons.push(`Transferable experience: ${matchedConcepts.slice(0, 4).join(", ")}`);
  if (matchedDomains.length) reasons.push(`Relevant domain evidence: ${matchedDomains.slice(0, 2).join(", ")}`);
  if (seniority.aligned) reasons.push("Seniority appears aligned");
  if (geography.aligned) reasons.push(geography.note);

  const gaps: string[] = [];
  if (!role && !preferredTitleMatch) gaps.push("Role family could not be classified confidently");
  else if (avoidedRole && role) gaps.push(`Candidate marked ${role.role_family} as a role to avoid`);
  else if (roleScore === 0 && role) gaps.push(`No direct evidence for ${role.role_family}`);
  else if (roleScore < 24 && role) gaps.push(`Prior title is adjacent to, rather than directly within, ${role.role_family}`);
  if (skillScore < 12) gaps.push("Limited responsibility and skill overlap found in the recorded evidence");
  else if (skillScore < 18) gaps.push("Some job responsibilities are not demonstrated explicitly in the recorded evidence");
  const missingConcepts = job.concepts.filter((label) => !candidate.candidateConceptSet.has(label));
  if (missingConcepts.length) gaps.push(`Validate: ${missingConcepts.slice(0, 3).join(", ")}`);
  if (job.seniority && !seniority.aligned) gaps.push("Seniority alignment needs review");
  if (!geography.aligned) gaps.push(geography.note);

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
    score: total,
    fitBand: total >= 75 ? "Strong" : total >= 55 ? "Possible" : "Exploratory",
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
  const [rolesResult, candidatesResult] = await Promise.all([
    admin.from("role_taxonomy").select("slug,function_name,role_family,specialty,aliases").eq("active", true),
    admin.from("placement_candidate_cache").select("*"),
  ]);
  const databaseQueryMs = roundMs(performance.now() - queryStartedAt);
  if (rolesResult.error) throw rolesResult.error;
  if (candidatesResult.error) throw candidatesResult.error;
  const cache = buildCandidateCache(
    (candidatesResult.data ?? []) as PlacementCandidateCacheRow[],
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
      cacheStatus: "refresh",
      loadMs: roundMs(performance.now() - loadStartedAt),
      databaseQueryMs,
      loadedAt: cache.loadedAt,
      candidateCount: cache.candidateCount,
    },
  };
}

export function resetCandidateCacheForTests(): void {
  cachedCandidateData = null;
  cacheLoadPromise = null;
}
