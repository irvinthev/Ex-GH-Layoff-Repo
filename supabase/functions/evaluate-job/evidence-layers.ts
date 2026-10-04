export type EvidenceLayerSummary = {
  layers: {
    l1: boolean;
    l2: boolean;
    l3: boolean;
  };
  available: string[];
  confidence: "High" | "Medium" | "Low";
  note: string;
};


export type MatchEvidenceAssessment = {
  strength: "Supported" | "Partial" | "Thin";
  note: string;
  bandAdjusted: boolean;
};

type CandidateEvidenceRow = {
  candidate_id?: string | null;
  former_job_title?: string | null;
  former_team?: string | null;
  function_name?: string | null;
  location_text?: string | null;
  public_description?: string | null;
  public_skills?: unknown;
  primary_role_slug?: string | null;
  seniority?: string | null;
  skills?: unknown;
  domains?: unknown;
  evidence?: unknown;
  candidate_preferences?: unknown;
};

function hasArrayValues(value: unknown): boolean {
  return Array.isArray(value) && value.some((entry) => String(entry ?? "").trim().length > 0);
}

function hasObjectValues(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.keys(value as Record<string, unknown>).length > 0;
}

/**
 * Placement Intelligence evidence model:
 * L1 = structured profile/taxonomy data.
 * L2 = candidate narrative and candidate-provided public skills/preferences.
 * L3 = enriched evidence package stored in candidate_features.evidence.
 *
 * Missing L3 never reduces fit. This function reports evidence depth separately
 * so sparse records are not treated as negative qualification evidence.
 */
export function summarizeEvidenceLayers(row: CandidateEvidenceRow | null | undefined): EvidenceLayerSummary {
  const l1 = Boolean(row && [
    row.former_job_title,
    row.former_team,
    row.function_name,
    row.location_text,
    row.primary_role_slug,
    row.seniority,
  ].some((value) => String(value ?? "").trim()))
    || hasArrayValues(row?.skills)
    || hasArrayValues(row?.domains);

  const description = String(row?.public_description ?? "").trim();
  const l2 = description.length >= 40
    || hasArrayValues(row?.public_skills)
    || hasObjectValues(row?.candidate_preferences);

  const l3 = hasObjectValues(row?.evidence);
  const available = [l1 ? "L1" : "", l2 ? "L2" : "", l3 ? "L3" : ""].filter(Boolean);

  const confidence: EvidenceLayerSummary["confidence"] = l1 && l2 && l3
    ? "High"
    : l1 && l2
      ? "Medium"
      : "Low";

  return {
    layers: { l1, l2, l3 },
    available,
    confidence,
    note: `Evidence depth: ${available.length ? available.join(" + ") : "limited source data"} · ${confidence} confidence`,
  };
}

export function attachEvidenceLayers<T extends {
  candidate?: {
    id?: string | null;
    formerJobTitle?: string | null;
    functionName?: string | null;
    location?: string | null;
    skills?: string[];
  };
  fitBand?: "Strong" | "Possible" | "Exploratory";
  technicalSkillEvidence?: boolean;
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
  rows: CandidateEvidenceRow[],
  options: { requiresTechnicalSkillEvidence?: boolean } = {},
): Array<T & { evidenceConfidence: EvidenceLayerSummary; evidenceAssessment: MatchEvidenceAssessment }> {
  const evidenceByCandidate = new Map<string, EvidenceLayerSummary>();
  for (const row of rows) {
    const id = String(row.candidate_id ?? "").trim();
    if (id) evidenceByCandidate.set(id, summarizeEvidenceLayers(row));
  }

  return matches.map((match) => {
    const id = String(match.candidate?.id ?? "").trim();
    const evidenceConfidence = evidenceByCandidate.get(id) ?? summarizeEvidenceLayers({
      candidate_id: id,
      former_job_title: match.candidate?.formerJobTitle ?? null,
      function_name: match.candidate?.functionName ?? null,
      location_text: match.candidate?.location ?? null,
      public_skills: match.candidate?.skills ?? [],
    });
    const breakdown = match.breakdown;
    const roleScore = breakdown?.roleFamily?.score ?? 0;
    const titleScore = breakdown?.titleSpecialty?.score ?? 0;
    const skillScore = breakdown?.skills?.score ?? 0;
    const domainScore = breakdown?.domain?.score ?? 0;
    // Recommendation support is capability-based. Seniority is a validation
    // condition and must not create or rescue qualification evidence.
    const roleSupported = roleScore >= 24;
    const titleSupported = titleScore >= 10;
    const capabilitySupported = skillScore >= 6 || domainScore >= 8;
    const identityOrCapabilitySupported = titleSupported || capabilitySupported;
    const substantiveSupport = skillScore > 0 || domainScore > 0;
    const technicalSkillRequired = Boolean(options.requiresTechnicalSkillEvidence);
    const directTechnicalEvidence = Boolean(match.technicalSkillEvidence);
    const corroborationSupported = technicalSkillRequired
      ? directTechnicalEvidence
      : substantiveSupport;
    const recommendationSupported = roleSupported && identityOrCapabilitySupported && corroborationSupported;

    const originalBand = match.fitBand ?? "Exploratory";
    const adjustedBand = originalBand === "Strong"
      ? (recommendationSupported ? "Strong" : "Possible")
      : originalBand === "Possible"
        ? (recommendationSupported ? "Possible" : "Exploratory")
        : "Exploratory";

    const strength: MatchEvidenceAssessment["strength"] = recommendationSupported
      ? "Supported"
      : roleSupported && identityOrCapabilitySupported
        ? "Partial"
        : "Thin";
    const bandAdjusted = adjustedBand !== originalBand;
    const evidenceAssessment: MatchEvidenceAssessment = {
      strength,
      bandAdjusted,
      note: recommendationSupported
        ? technicalSkillRequired
          ? "Recommendation is supported by role/title alignment plus direct technical skill evidence."
          : "Recommendation is supported by role/title alignment plus corroborating skill or domain evidence."
        : roleSupported && identityOrCapabilitySupported
          ? technicalSkillRequired
            ? "Role-family relevance is present, but the current profile does not evidence a technical skill explicitly required by this role."
            : "Role-family relevance is present, but corroborating skill or domain evidence is limited."
          : roleSupported
            ? "Role-family relevance is present, but neither title alignment nor enough capability evidence is recorded for a higher-confidence recommendation."
            : "Current evidence is too thin for a higher-confidence recommendation.",
    };

    return {
      ...match,
      fitBand: adjustedBand,
      evidenceConfidence,
      evidenceAssessment,
      reasons: [...(match.reasons ?? []), evidenceConfidence.note],
    };
  });
}
