import type { CandidateProfile } from "./types.ts";

export type EvidenceLayerSummary = {
  layers: {
    l1: boolean;
    l2: boolean;
    l3: boolean;
  };
  available: string[];
  /**
   * Recruiter-facing description of how much candidate evidence is available.
   * This is intentionally separate from qualification merit.
   */
  sufficiency: "High" | "Moderate" | "Limited";
  /**
   * Backward-compatible alias for saved evaluations and older clients.
   * New code should use sufficiency.
   */
  confidence: "High" | "Medium" | "Low";
  jobRelevantCapabilities: number;
  note: string;
};

export type MatchEvidenceAssessment = {
  strength: "Supported" | "Partial" | "Thin";
  note: string;
  /**
   * Retained for backward compatibility. Evidence sufficiency no longer changes
   * qualification fit bands, so this is always false for new evaluations.
   */
  bandAdjusted: boolean;
};

/**
 * L1 = structured public profile facts.
 * L2 = candidate-provided public narrative/public skills.
 * L3 = approved enriched qualification evidence.
 *
 * Evidence sufficiency is metadata, not merit. Missing evidence means "not
 * established from the available profile", not "candidate does not have it".
 */
export function summarizeEvidenceLayers(
  profile: CandidateProfile | null | undefined,
  jobRelevantCapabilities = 0,
): EvidenceLayerSummary {
  const l1 = Boolean(profile && [
    profile.formerJobTitle,
    profile.formerTeam,
    profile.functionName,
    profile.location,
  ].some((value) => String(value ?? "").trim()));

  const description = String(profile?.publicDescription ?? "").trim();
  const l2 = description.length >= 40 || Boolean(profile?.publicSkills?.length);
  const l3 = Boolean(profile?.hasEnrichedEvidence);
  const available = [l1 ? "L1" : "", l2 ? "L2" : "", l3 ? "L3" : ""].filter(Boolean);

  const sufficiency: EvidenceLayerSummary["sufficiency"] = jobRelevantCapabilities === 0
    ? "Limited"
    : jobRelevantCapabilities >= 2 && l1 && l2 && l3
      ? "High"
      : "Moderate";

  const confidence: EvidenceLayerSummary["confidence"] = sufficiency === "High"
    ? "High"
    : sufficiency === "Moderate"
      ? "Medium"
      : "Low";

  const layerText = available.length ? available.join(" + ") : "limited source data";
  const note = sufficiency === "Limited"
    ? `Evidence sufficiency: Limited · ${layerText}; no job-relevant capability is established. Missing profile evidence is not treated as evidence that the candidate lacks a capability (unknown, not absent).`
    : `Evidence sufficiency: ${sufficiency} · ${layerText}; ${jobRelevantCapabilities} distinct job-relevant ${jobRelevantCapabilities === 1 ? "capability is" : "capabilities are"} established.`;

  return {
    layers: { l1, l2, l3 },
    available,
    sufficiency,
    confidence,
    jobRelevantCapabilities,
    note,
  };
}

export function attachEvidenceLayers<T extends {
  candidate?: {
    id?: string | null;
  };
  fitBand?: "Strong" | "Possible" | "Exploratory";
  technicalSkillEvidence?: boolean;
  coreCoverage?: {
    evidenced?: string[];
  };
  breakdown?: {
    roleFamily?: { score: number; max: number };
    titleSpecialty?: { score: number; max: number };
    skills?: { score: number; max: number };
    domain?: { score: number; max: number };
    seniority?: { score: number; max: number };
    location?: { score: number; max: number };
  };
  reasons?: string[];
}>(
  matches: T[],
  candidates: CandidateProfile[],
  options: { requiresTechnicalSkillEvidence?: boolean } = {},
): Array<T & {
  evidenceSufficiency: EvidenceLayerSummary;
  evidenceConfidence: EvidenceLayerSummary;
  evidenceAssessment: MatchEvidenceAssessment;
}> {
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));

  return matches.map((match) => {
    const id = String(match.candidate?.id ?? "").trim();
    const jobRelevantCapabilities = match.coreCoverage?.evidenced?.length ?? 0;
    const evidenceSufficiency = summarizeEvidenceLayers(candidateById.get(id), jobRelevantCapabilities);
    const breakdown = match.breakdown;
    const roleScore = breakdown?.roleFamily?.score ?? 0;
    const titleScore = breakdown?.titleSpecialty?.score ?? 0;
    const skillScore = breakdown?.skills?.score ?? 0;

    // Recommendation support describes the evidence observed for this specific
    // job. It does not change qualification score or fit band.
    const roleSupported = roleScore >= 24;
    const titleSupported = titleScore >= 10;
    const capabilitySupported = skillScore >= 6 && jobRelevantCapabilities > 0;
    const technicalSkillRequired = Boolean(options.requiresTechnicalSkillEvidence);
    const directTechnicalEvidence = Boolean(match.technicalSkillEvidence);
    const corroborationSupported = technicalSkillRequired
      ? directTechnicalEvidence
      : capabilitySupported;
    const recommendationSupported = roleSupported && capabilitySupported && corroborationSupported;

    const strength: MatchEvidenceAssessment["strength"] = recommendationSupported
      ? "Supported"
      : roleSupported && (titleSupported || capabilitySupported)
        ? "Partial"
        : "Thin";

    const evidenceAssessment: MatchEvidenceAssessment = {
      strength,
      bandAdjusted: false,
      note: recommendationSupported
        ? technicalSkillRequired
          ? "Observed evidence supports role/title alignment plus a technical skill explicitly required by this role."
          : "Observed evidence supports role/title alignment plus corroborating capability or domain evidence."
        : roleSupported && (titleSupported || capabilitySupported)
          ? technicalSkillRequired
            ? "Role-family relevance is present, but the available profile does not currently evidence a technical skill explicitly required by this role."
            : "Role-family relevance is present, but the available profile does not establish a core job-relevant capability."
          : roleSupported
            ? "Role-family relevance is present, but the available profile does not currently establish enough title or capability evidence for a stronger evidence assessment."
            : "The available profile contains limited evidence for this role. Treat unobserved capabilities as unknown, not absent.",
    };

    return {
      ...match,
      // Do not modify fitBand here. Qualification and evidence sufficiency are
      // deliberately independent axes.
      evidenceSufficiency,
      evidenceConfidence: evidenceSufficiency,
      evidenceAssessment,
      reasons: [...(match.reasons ?? []), evidenceSufficiency.note],
    };
  });
}
