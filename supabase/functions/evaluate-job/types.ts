import type { RequirementUnit } from "./qualification-evidence.ts";
export type Role = {
  slug: string;
  function_name: string;
  role_family: string;
  specialty: string | null;
  aliases: string[];
};

export type RolePreferenceRecord = {
  role_slug: string;
  preference: "target" | "open" | "avoid";
  priority: number | null;
};

export type CandidatePreferenceRecord = {
  target_titles: string[];
  preferred_locations: string[];
  remote_preference: string | null;
};

export type PlacementCandidateCacheRow = {
  candidate_id: string;
  first_name: string;
  last_name: string;
  former_job_title: string | null;
  former_team: string | null;
  function_name: string | null;
  location_text: string | null;
  linkedin_url: string | null;
  public_description: string | null;
  public_skills: string[] | null;
  work_preferences?: string[] | null;
  open_to_relocation?: string | null;
  years_experience_band?: string | null;
  primary_role_slug: string | null;
  seniority: string | null;
  skills: string[] | null;
  domains: string[] | null;
  evidence: Record<string, unknown> | null;
  role_preferences: RolePreferenceRecord[] | null;
  candidate_preferences: CandidatePreferenceRecord | null;
};

export type ReviewerEvidenceRecord = {
  id?: string;
  candidate_id: string;
  evidence_type: "capability" | "title";
  value: string;
  status: "validated" | "rejected";
  source_type: "linkedin" | "resume" | "portfolio" | "direct_knowledge" | "other";
  source_url: string | null;
  note: string | null;
  reviewed_by: string;
  reviewed_at: string;
  active: boolean;
};

export type TokenizedLabel = {
  raw: string;
  normalized: string;
  tokens: string[];
  concepts: string[];
};

export type CachedRole = Role & {
  phrases: string[];
  phraseTokens: string[];
  normalizedFunctionName: string;
};

export type CandidateProfile = {
  id: string;
  name: string;
  formerJobTitle: string | null;
  formerTeam: string | null;
  functionName: string | null;
  functionNameNormalized: string;
  location: string | null;
  locationTokens: string[];
  linkedinUrl: string | null;
  candidateRole: string | null;
  seniority: string | null;
  remotePreference: string | null;
  workPreferences: string[];
  openToRelocation: string | null;
  yearsExperienceBand: string | null;
  preferredLocations: string[];
  preferredLocationTokens: string[][];
  rolePreferences: Map<string, RolePreferenceRecord>;
  candidateTitles: TokenizedLabel[];
  publicDescription: string | null;
  publicSkills: string[];
  enrichedSkills: string[];
  enrichedEvidence: string[];
  domains: string[];
  hasEnrichedEvidence: boolean;
  allSkills: string[];
  skillEntries: TokenizedLabel[];
  domainEntries: TokenizedLabel[];
  evidenceNormalized: string;
  candidateConcepts: string[];
  candidateConceptSet: Set<string>;
  reviewerEvidence: ReviewerEvidenceRecord[];
};

export type JobProfile = {
  title: string;
  description: string;
  titleText: string;
  descriptionText: string;
  coreRequirements: RequirementUnit[];
  requirementsParsed: boolean;
  preferredRequirements: RequirementUnit[];
  titleTokens: string[];
  jobText: string;
  jobTextTokens: string[];
  concepts: string[];
  conceptSet: Set<string>;
  seniority: string | null;
  location: string;
  locationTokens: string[];
  remoteType: string;
  requiresTechnicalSkillEvidence: boolean;
  technicalRequirementTerms: string[];
};

export type CandidateMatch = {
  candidate: {
    id: string;
    name: string;
    formerJobTitle: string | null;
    functionName: string | null;
    location: string | null;
    linkedinUrl: string | null;
    skills: string[];
  };
  score: number;
  fitBand: "Strong" | "Possible" | "Exploratory";
  technicalSkillEvidence: boolean;
  coreCoverage: {
    recognized: string[];
    evidenced: string[];
    notEvidenced: string[];
    ratio: number | null;
    preferredEvidenced: string[];
  };
  evidenceTrace: Array<{
    capability: string;
    source: "held_title" | "directory_team" | "directory_description" | "public_skill" | "enriched_skill" | "enriched_evidence" | "reviewer_validated";
    evidence: string;
    reviewerSourceType?: ReviewerEvidenceRecord["source_type"];
  }>;
  breakdown: {
    roleFamily: { score: number; max: 30 };
    titleSpecialty: { score: number; max: 15 };
    skills: { score: number; max: 20 };
    domain: { score: number; max: 15 };
    seniority: { score: number; max: 10 };
    location: { score: number; max: 10 };
  };
  reviewerEvidence: Array<{
    evidenceType: ReviewerEvidenceRecord["evidence_type"];
    value: string;
    status: ReviewerEvidenceRecord["status"];
    sourceType: ReviewerEvidenceRecord["source_type"];
    sourceUrl: string | null;
  }>;
  reasons: string[];
  gaps: string[];
};

export type CandidateCache = {
  roles: CachedRole[];
  candidates: CandidateProfile[];
  loadedAt: string;
  expiresAt: number;
  candidateCount: number;
};

export type CacheLoadMetrics = {
  cacheStatus: "hit" | "refresh";
  loadMs: number;
  databaseQueryMs: number;
  loadedAt: string;
  candidateCount: number;
};
