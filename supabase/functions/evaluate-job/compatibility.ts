import { qualificationSections } from "./qualification-evidence.ts";
import type {
  CandidateProfile,
  CompatibilityAssessment,
  CompatibilitySignal,
  CompatibilityStatus,
  JobProfile,
} from "./types.ts";

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ");
}

function normalizeWorkModel(value: unknown): "remote" | "hybrid" | "onsite" | null {
  const text = normalize(value);
  if (!text) return null;
  if (/\bremote\b/.test(text)) return "remote";
  if (/\bhybrid\b/.test(text)) return "hybrid";
  if (/\bon\s*-?\s*site\b|\bonsite\b|\bin[- ]office\b/.test(text)) return "onsite";
  return null;
}

function locationTokens(value: unknown): string[] {
  return normalize(value)
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !["the", "and", "usa", "united", "states", "america"].includes(token));
}

function locationsAppearAligned(candidateLocation: string | null, jobLocation: string): boolean | null {
  const candidateTokens = locationTokens(candidateLocation);
  const jobTokens = locationTokens(jobLocation);
  if (!candidateTokens.length || !jobTokens.length) return null;
  return candidateTokens.some((token) => jobTokens.includes(token));
}

type ExperienceBand = { min: number; max: number | null };

function parseCandidateExperienceBand(value: string | null): ExperienceBand | null {
  const text = normalize(value);
  if (!text) return null;
  const range = text.match(/^(\d+)\s*-\s*(\d+)\s*years?$/);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const plus = text.match(/^(\d+)\s*\+\s*years?$/);
  if (plus) return { min: Number(plus[1]), max: null };
  const single = text.match(/^(\d+)\s*years?$/);
  if (single) return { min: Number(single[1]), max: Number(single[1]) };
  return null;
}

function parseJobExperienceRequirement(description: string): ExperienceBand | null {
  const core = qualificationSections(description).core;
  const text = normalize(core);

  // Prefer explicit requirement-style phrases and use the strictest minimum if
  // more than one is present. This remains intentionally conservative.
  const candidates: ExperienceBand[] = [];
  for (const match of text.matchAll(/(?:at least|minimum(?: of)?|requires?|required|minimum qualifications?:?)?\s*(\d+)\s*(?:-\s*(\d+)|\+)?\s+years?\s+(?:of\s+)?experience/g)) {
    const min = Number(match[1]);
    const max = match[2] ? Number(match[2]) : null;
    if (Number.isFinite(min)) candidates.push({ min, max });
  }
  if (!candidates.length) return null;
  return candidates.sort((a, b) => b.min - a.min)[0];
}

function workModelCompatibility(candidate: CandidateProfile, job: JobProfile): CompatibilitySignal {
  const jobModel = normalizeWorkModel(job.remoteType || job.location);
  if (!jobModel) return { status: "unknown", note: "Job work arrangement is not clearly specified." };

  const preferences = new Set(candidate.workPreferences.map((value) => normalizeWorkModel(value)).filter(Boolean));
  if (!preferences.size) {
    const legacy = normalizeWorkModel(candidate.remotePreference);
    if (legacy) preferences.add(legacy);
  }
  if (!preferences.size) return { status: "unknown", note: "Candidate work-arrangement preference is not recorded." };

  if (preferences.has(jobModel)) {
    return { status: "compatible", note: `Candidate is open to ${jobModel} work.` };
  }

  return {
    status: "mismatch",
    note: `Job is ${jobModel}, while the candidate's recorded work preferences do not include ${jobModel}.`,
  };
}

function locationCompatibility(candidate: CandidateProfile, job: JobProfile): CompatibilitySignal {
  const jobModel = normalizeWorkModel(job.remoteType || job.location);
  if (jobModel === "remote") return { status: "compatible", note: "Remote role does not require local location alignment." };
  if (!job.location.trim()) return { status: "unknown", note: "Job location is not recorded." };
  if (!candidate.location?.trim()) return { status: "unknown", note: "Candidate location is not recorded." };

  const aligned = locationsAppearAligned(candidate.location, job.location);
  if (aligned === true) return { status: "compatible", note: "Candidate and job locations appear aligned." };
  if (aligned === null) return { status: "unknown", note: "Location alignment could not be established from the available location data." };

  if (candidate.openToRelocation === "yes" || candidate.openToRelocation === "conditional") {
    return {
      status: "conditional",
      note: candidate.openToRelocation === "yes"
        ? "Locations differ, but the candidate is open to relocation."
        : "Locations differ; the candidate may relocate depending on the opportunity.",
    };
  }
  if (candidate.openToRelocation === "no") {
    return { status: "mismatch", note: "Locations differ and the candidate is not open to relocation." };
  }
  return { status: "unknown", note: "Locations differ, but relocation preference is not recorded." };
}

function relocationCompatibility(candidate: CandidateProfile, job: JobProfile): CompatibilitySignal {
  const jobModel = normalizeWorkModel(job.remoteType || job.location);
  if (jobModel === "remote") return { status: "compatible", note: "Relocation is not required for a remote role." };
  if (!job.location.trim() || !candidate.location?.trim()) {
    return { status: "unknown", note: "Relocation need cannot be established without both job and candidate locations." };
  }

  const aligned = locationsAppearAligned(candidate.location, job.location);
  if (aligned === true) return { status: "compatible", note: "Candidate appears local to the role; relocation is not required." };
  if (candidate.openToRelocation === "yes") return { status: "compatible", note: "Candidate is open to relocation." };
  if (candidate.openToRelocation === "conditional") return { status: "conditional", note: "Candidate may relocate depending on the opportunity." };
  if (candidate.openToRelocation === "no") return { status: "mismatch", note: "Candidate is not open to relocation." };
  return { status: "unknown", note: "Candidate relocation preference is not recorded." };
}

function experienceCompatibility(candidate: CandidateProfile, job: JobProfile): CompatibilitySignal {
  const candidateBand = parseCandidateExperienceBand(candidate.yearsExperienceBand);
  const requirement = parseJobExperienceRequirement(job.description);
  if (!requirement) return { status: "unknown", note: "A clear years-of-experience requirement was not detected in the job description." };
  if (!candidateBand) return { status: "unknown", note: "Candidate years-of-experience band is not recorded." };

  if (candidateBand.max !== null && candidateBand.max < requirement.min) {
    return {
      status: "conditional",
      note: `Recorded experience band (${candidate.yearsExperienceBand}) is below the job's detected ${requirement.min}+ year requirement; validate actual experience before screening out.`,
    };
  }

  if (requirement.max !== null && candidateBand.min > requirement.max + 2) {
    return {
      status: "conditional",
      note: `Candidate's recorded experience band (${candidate.yearsExperienceBand}) is materially above the job's detected ${requirement.min}-${requirement.max} year range; level/scope may need review.`,
    };
  }

  return {
    status: "compatible",
    note: `Recorded experience band appears compatible with the job's detected ${requirement.min}${requirement.max !== null ? `-${requirement.max}` : "+"} year requirement.`,
  };
}

function overallStatus(signals: CompatibilitySignal[]): CompatibilityStatus {
  if (signals.some((signal) => signal.status === "mismatch")) return "mismatch";
  if (signals.some((signal) => signal.status === "conditional")) return "conditional";
  if (signals.some((signal) => signal.status === "unknown")) return "unknown";
  return "compatible";
}

export function evaluateCompatibility(candidate: CandidateProfile, job: JobProfile): CompatibilityAssessment {
  const workModel = workModelCompatibility(candidate, job);
  const location = locationCompatibility(candidate, job);
  const relocation = relocationCompatibility(candidate, job);
  const experience = experienceCompatibility(candidate, job);

  return {
    overall: overallStatus([workModel, location, relocation, experience]),
    workModel,
    location,
    relocation,
    experience,
  };
}
