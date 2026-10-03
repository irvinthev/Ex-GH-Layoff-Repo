type Role = {
  slug: string;
  function_name: string;
  role_family: string;
  specialty: string | null;
  aliases: string[];
};

type Member = {
  id: string;
  first_name: string;
  last_name: string;
  former_job_title: string | null;
  former_team: string | null;
  function_name: string | null;
  location_text: string | null;
  linkedin_url: string | null;
  public_description: string | null;
  public_skills: string[];
};

type Features = {
  candidate_id: string;
  primary_role_slug: string | null;
  seniority: string | null;
  skills: string[];
  domains: string[];
  evidence: Record<string, unknown>;
};

type RolePreference = {
  candidate_id: string;
  role_slug: string;
  preference: "target" | "open" | "avoid";
  priority: number | null;
};

const CONCEPT_GROUPS = [
  { label: "Implementation lifecycle", terms: ["implementation", "onboarding", "deployment", "rollout", "launch", "go live", "cutover", "adoption"] },
  { label: "Customer delivery", terms: ["customer delivery", "customer success", "client delivery", "client services", "customer implementation"] },
  { label: "Process and workflow design", terms: ["process improvement", "process optimization", "workflow transformation", "workflow design", "operating model", "scalable workflow"] },
  { label: "Data and integrations", terms: ["data migration", "data onboarding", "data flow", "data integration", "integration", "api", "webhook"] },
  { label: "Risk and escalations", terms: ["risk management", "implementation risk", "escalation", "issue resolution", "troubleshooting", "compliance"] },
  { label: "Cross-functional leadership", terms: ["cross functional", "stakeholder management", "multiple stakeholders", "partnering across", "executive update", "sales and engineering", "cross team collaboration"] },
  { label: "Automation", terms: ["automation", "automated", "scripting", "python"] },
  { label: "Change and enablement", terms: ["change management", "enablement", "training", "organizational change"] },
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

function normalize(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: unknown): string[] {
  return [...new Set(
    normalize(value)
      .split(" ")
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
      .map((word) => {
        if (word.length > 5 && word.endsWith("sses")) return word.slice(0, -2);
        if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
        if (word.length > 4 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
        return word;
      }),
  )];
}

export function includesPhrase(text: string, phrase: string): boolean {
  const cleaned = normalize(phrase);
  if (cleaned === "go") return /\b(golang|go programming|go language)\b/.test(text);
  return cleaned.length > 1 && (` ${text} `).includes(` ${cleaned} `);
}

function overlapRatio(left: string[], right: string[]): number {
  if (!left.length || !right.length) return 0;
  const rightSet = new Set(right);
  const overlap = left.filter((word) => rightSet.has(word)).length;
  return Math.min(1, overlap / Math.min(left.length, right.length));
}

function conceptLabels(value: unknown): string[] {
  const text = normalize(value);
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
    ["lead", /\b(lead|staff|principal)\b/],
    ["senior", /\b(senior|sr\.?|level 3|iii)\b/],
    ["manager", /\b(manager|management)\b/],
    ["mid", /\b(mid level|mid-level|level 2|ii)\b/],
    ["entry", /\b(junior|jr\.?|entry level|associate|level 1)\b/],
    ["intern", /\b(intern|internship)\b/],
  ];

  for (const [level, pattern] of checks) {
    if (pattern.test(titleText)) return level;
  }

  return null;
}

export function classifyRole(title: string, description: string, roles: Role[]): Role | null {
  const titleText = normalize(title);
  const bodyText = normalize(description).slice(0, 6000);
  let best: { role: Role; points: number } | null = null;

  for (const role of roles) {
    const phrases = [role.role_family, role.specialty, ...role.aliases].filter(Boolean) as string[];
    let points = 0;
    for (const phrase of phrases) {
      if (includesPhrase(titleText, phrase)) points += 8;
      if (includesPhrase(bodyText, phrase)) points += 2;
    }
    const roleTokens = tokens(phrases.join(" "));
    points += overlapRatio(tokens(titleText), roleTokens) * 5;
    if (!best || points > best.points) best = { role, points };
  }

  return best && best.points >= 2 ? best.role : null;
}

function seniorityScore(candidate: string | null, target: string | null): { score: number; aligned: boolean } {
  if (!candidate || candidate === "unknown" || !target) return { score: 5, aligned: false };
  const candidateRank = SENIORITY_RANK[candidate];
  const targetRank = SENIORITY_RANK[target];
  if (candidateRank === undefined || targetRank === undefined) return { score: 5, aligned: false };
  const difference = Math.abs(candidateRank - targetRank);
  return { score: difference === 0 ? 10 : difference === 1 ? 7 : difference === 2 ? 3 : 0, aligned: difference <= 1 };
}

export function locationScore(candidateLocation: string | null, jobLocation: string, remoteType: string): { score: number; aligned: boolean; note: string } {
  return {score:5,aligned:false,note:"Confirm location, remote hiring eligibility, and work-model preferences with the employer"};

}

export function scoreCandidate(member: Member, feature: Features, preferences: RolePreference[], role: Role | null, title: string, description: string, location: string, remoteType: string) {
  const jobText = normalize(`${title} ${description}`);
  const candidateEvidence = normalize([
    member.former_job_title,
    member.former_team,
    member.public_description,
    ...(member.public_skills ?? []),
    ...(feature.skills ?? []),
    ...(feature.domains ?? []),
    JSON.stringify(feature.evidence ?? {}),
  ].join(" "));
  const candidateRole = feature.primary_role_slug;
  const targetPreference = role
    ? preferences.find((item) => item.role_slug === role.slug && item.preference !== "avoid")
    : null;
  const avoidedRole = role
    ? preferences.some((item) => item.role_slug === role.slug && item.preference === "avoid")
    : false;
  const rolePhrases = role
    ? [role.role_family, role.specialty, ...role.aliases].filter(Boolean) as string[]
    : [];
  const evidenceRoleMatch = rolePhrases.some((phrase) => includesPhrase(candidateEvidence, phrase));
  const roleScore = !role || avoidedRole
    ? 0
    : candidateRole === role.slug
      ? 30
      : targetPreference && evidenceRoleMatch
        ? 28
        : evidenceRoleMatch
          ? 24
          : normalize(member.function_name) === normalize(role.function_name)
            ? 18
            : targetPreference
              ? 12
              : 0;

  const candidateTitleTokens = tokens(`${member.former_job_title} ${member.former_team}`);
  const targetTitleTokens = tokens(`${title} ${role?.role_family ?? ""} ${role?.specialty ?? ""}`);
  const titleScore = Math.round(overlapRatio(candidateTitleTokens, targetTitleTokens) * 15);

  const allSkills = [...new Set([...(feature.skills ?? []), ...(member.public_skills ?? [])])];
  const matchedSkills = allSkills.filter((skill) => {
    const phrase = normalize(skill);
    return includesPhrase(jobText, phrase) || overlapRatio(tokens(skill), tokens(jobText)) >= 0.67;
  });
  const jobConcepts = conceptLabels(jobText);
  const candidateConcepts = conceptLabels(candidateEvidence);
  const matchedConcepts = jobConcepts.filter((label) => candidateConcepts.includes(label));
  const conceptCoverage = jobConcepts.length ? matchedConcepts.length / jobConcepts.length : 0;
  const skillScore = Math.min(20, Math.min(6, matchedSkills.length * 2) + Math.round(conceptCoverage * 14));

  const domains = feature.domains ?? [];
  const matchedDomains = domains.filter((domain) =>
    includesPhrase(jobText, domain)
    || overlapRatio(tokens(domain), tokens(jobText)) >= 0.67
    || conceptLabels(domain).some((label) => jobConcepts.includes(label))
  );
  const domainScore = Math.min(15, matchedDomains.length * 4);

  const targetSeniority = inferSeniority(title, description);
  const seniority = seniorityScore(feature.seniority, targetSeniority);
  const geography = locationScore(member.location_text, location, remoteType);
  const total = roleScore + titleScore + skillScore + domainScore + seniority.score + geography.score;

  const reasons: string[] = [];
  if (roleScore === 30 && role) reasons.push(`Direct ${role.role_family} role-family match`);
  else if (roleScore === 28 && role) reasons.push(`Target ${role.role_family} role supported by experience evidence`);
  else if (roleScore === 24 && role) reasons.push(`Experience evidence supports ${role.role_family}`);
  else if (roleScore === 18 && role) reasons.push(`Related ${role.function_name} function`);
  else if (roleScore === 12 && role) reasons.push(`Candidate is open to ${role.role_family}; qualification evidence is limited`);
  if (matchedSkills.length) reasons.push(`Skills named in role: ${matchedSkills.slice(0, 3).join(", ")}`);
  if (matchedConcepts.length) reasons.push(`Shared experience themes to review: ${matchedConcepts.slice(0, 4).join(", ")}`);
  if (matchedDomains.length) reasons.push(`Relevant domain evidence: ${matchedDomains.slice(0, 2).join(", ")}`);
  if (seniority.aligned) reasons.push("Seniority appears aligned");
  if (geography.aligned) reasons.push(geography.note);

  const gaps: string[] = ["Confirm required years, leadership scope and essential qualifications against your experience"];
  if (!role) gaps.push("Role family could not be classified confidently");
  else if (avoidedRole) gaps.push(`Candidate marked ${role.role_family} as a role to avoid`);
  else if (roleScore === 0) gaps.push(`No direct evidence for ${role.role_family}`);
  else if (roleScore < 30) gaps.push(`Prior title is adjacent to, rather than directly within, ${role.role_family}`);
  if (skillScore < 12) gaps.push("Limited responsibility and skill overlap found in the recorded evidence");
  else if (skillScore < 18) gaps.push("Some job responsibilities are not demonstrated explicitly in the recorded evidence");
  const missingConcepts = jobConcepts.filter((label) => !candidateConcepts.includes(label));
  if (missingConcepts.length) gaps.push(`Validate: ${missingConcepts.slice(0, 3).join(", ")}`);
  if (targetSeniority && !seniority.aligned) gaps.push("Seniority alignment needs review");
  if (!geography.aligned) gaps.push(geography.note);

  return {
    candidate: {
      id: member.id,
      name: `${member.first_name} ${member.last_name}`,
      formerJobTitle: member.former_job_title,
      functionName: member.function_name,
      location: member.location_text,
      linkedinUrl: member.linkedin_url,
      skills: allSkills,
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


