import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import { importJobFromUrl } from "./job-import.ts";

const ALLOWED_ORIGINS = new Set([
  "https://irvinthev.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
]);

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

function includesPhrase(text: string, phrase: string): boolean {
  const cleaned = normalize(phrase);
  return cleaned.length > 1 && text.includes(cleaned);
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

function inferSeniority(title: string, description: string): string | null {
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

function classifyRole(title: string, description: string, roles: Role[]): Role | null {
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

function locationScore(candidateLocation: string | null, jobLocation: string, remoteType: string): { score: number; aligned: boolean; note: string } {
  const remote = normalize(`${remoteType} ${jobLocation}`).includes("remote");
  if (remote) return { score: 10, aligned: true, note: "Remote-compatible role" };
  if (!jobLocation) return { score: 5, aligned: false, note: "Job location not supplied" };
  if (!candidateLocation) return { score: 5, aligned: false, note: "Candidate location not recorded" };
  const ratio = overlapRatio(tokens(candidateLocation), tokens(jobLocation));
  return ratio > 0 ? { score: 10, aligned: true, note: "Location appears aligned" } : { score: 2, aligned: false, note: "Location needs review" };
}

function scoreCandidate(member: Member, feature: Features, preferences: RolePreference[], role: Role | null, title: string, description: string, location: string, remoteType: string) {
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
  if (matchedConcepts.length) reasons.push(`Transferable experience: ${matchedConcepts.slice(0, 4).join(", ")}`);
  if (matchedDomains.length) reasons.push(`Relevant domain evidence: ${matchedDomains.slice(0, 2).join(", ")}`);
  if (seniority.aligned) reasons.push("Seniority appears aligned");
  if (geography.aligned) reasons.push(geography.note);

  const gaps: string[] = [];
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

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://irvinthev.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function getDefaultKey(currentName: string, legacyName: string): string {
  const current = Deno.env.get(currentName);
  if (current) {
    try {
      const keys = JSON.parse(current) as Record<string, string>;
      if (keys.default) return keys.default;
    } catch {
      console.error(`Could not parse ${currentName}`);
    }
  }
  return Deno.env.get(legacyName) ?? "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  let authorizedAdmin = false;

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json(req, { error: "Authentication required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const publishableKey = getDefaultKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
    const serviceRoleKey = getDefaultKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !publishableKey || !serviceRoleKey) throw new Error("Function environment is incomplete");

    const authClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    const email = String(authData.user?.email ?? "").trim().toLowerCase();
    if (authError || !authData.user || !email) return json(req, { error: "Invalid session" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: allowlistEntry, error: allowlistError } = await admin
      .from("admin_allowlist")
      .select("email")
      .eq("email", email)
      .eq("active", true)
      .maybeSingle();
    if (allowlistError) throw allowlistError;
    if (!allowlistEntry) return json(req, { error: "This account is not authorized for Placement Intelligence" }, 403);
    authorizedAdmin = true;

    const payload = await req.json().catch(() => null) as Record<string, unknown> | null;
    let title = String(payload?.title ?? "").trim().slice(0, 300);
    let description = String(payload?.description ?? "").trim().slice(0, 50000);
    let location = String(payload?.location ?? "").trim().slice(0, 300);
    let remoteType = String(payload?.remoteType ?? "").trim().slice(0, 100);
    const jobUrl = String(payload?.jobUrl ?? "").trim().slice(0, 2048);
    let sourceUrl: string | null = null;
    let sourceMode: "structured" | "page_text" | "pasted" | "url_plus_paste" = "pasted";
    let importWarning: string | null = null;

    if (jobUrl) {
      try {
        const imported = await importJobFromUrl(jobUrl);
        sourceUrl = imported.canonicalUrl;
        sourceMode = description.length >= 50 ? "url_plus_paste" : imported.sourceMode;
        title ||= imported.title;
        description ||= imported.description;
        location ||= imported.location;
        remoteType ||= imported.remoteType;
      } catch (importError) {
        if (description.length < 50) {
          const detail = importError instanceof Error ? importError.message : "The job page could not be read";
          return json(req, {
            error: `${detail}. Paste the job description below and try again.`,
            code: "JOB_URL_UNREADABLE",
          }, 422);
        }
        importWarning = "The job page could not be read, so the pasted description was used.";
      }
    }

    if (description.length < 50) {
      return json(req, { error: "Add a public job URL or paste at least 50 characters of the job description" }, 400);
    }

    const [rolesResult, membersResult, featuresResult, preferencesResult] = await Promise.all([
      admin.from("role_taxonomy").select("slug,function_name,role_family,specialty,aliases").eq("active", true),
      admin.from("network_members").select("id,first_name,last_name,former_job_title,former_team,function_name,location_text,linkedin_url,public_description,public_skills").eq("matching_opt_in", true).eq("open_to_work", true),
      admin.from("candidate_features").select("candidate_id,primary_role_slug,seniority,skills,domains,evidence"),
      admin.from("candidate_role_preferences").select("candidate_id,role_slug,preference,priority"),
    ]);
    if (rolesResult.error) throw rolesResult.error;
    if (membersResult.error) throw membersResult.error;
    if (featuresResult.error) throw featuresResult.error;
    if (preferencesResult.error) throw preferencesResult.error;

    const roles = (rolesResult.data ?? []) as Role[];
    const role = classifyRole(title, description, roles);
    const featureMap = new Map((featuresResult.data ?? []).map((item: Features) => [item.candidate_id, item]));
    const preferenceMap = new Map<string, RolePreference[]>();
    for (const item of (preferencesResult.data ?? []) as RolePreference[]) {
      const existing = preferenceMap.get(item.candidate_id) ?? [];
      existing.push(item);
      preferenceMap.set(item.candidate_id, existing);
    }
    const matches = ((membersResult.data ?? []) as Member[])
      .map((member) => {
        const feature = featureMap.get(member.id);
        return feature ? scoreCandidate(member, feature, preferenceMap.get(member.id) ?? [], role, title, description, location, remoteType) : null;
      })
      .filter(Boolean)
      .sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0));

    return json(req, {
      evaluation: {
        title: title || "Untitled role",
        role: role ? { slug: role.slug, functionName: role.function_name, roleFamily: role.role_family, specialty: role.specialty } : null,
        seniority: inferSeniority(title, description),
        location: location || null,
        remoteType: remoteType || null,
        candidateCount: matches.length,
        evaluatedAt: new Date().toISOString(),
        methodology: "Evidence-aware deterministic scoring v2; manual review required",
        sourceUrl,
        sourceMode,
        importWarning,
      },
      matches,
    });
  } catch (error) {
    console.error("evaluate-job failed", error);
    const detail = error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String(error.message)
        : String(error);
    return json(req, {
      error: authorizedAdmin
        ? `Evaluation failed: ${detail}`
        : "The evaluation could not be completed",
    }, 500);
  }
});
