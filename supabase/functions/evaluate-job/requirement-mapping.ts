import type { CandidateMatch, JobRequirement } from "./types.ts";

export type RequirementEvidenceLink = {
  requirementId: string;
  candidateId: string;
  capabilityLabel: string;
  evidenceSource: "directory" | "enriched" | "resume" | "reviewer";
  matchStrength: "exact" | "adjacent" | "interpretable" | "contextual" | undefined;
  candidateEvidenceText: string;
  requirementInterpretation: string;
  reviewStatus: "supported" | "gaps" | "adjacent_field" | "unvalidated";
};

function evidenceSource(source: CandidateMatch["evidenceTrace"][number]["source"]): RequirementEvidenceLink["evidenceSource"] {
  if (source === "resume_derived") return "resume";
  if (source === "enriched_skill" || source === "enriched_evidence") return "enriched";
  if (source === "reviewer_validated") return "reviewer";
  return "directory";
}

export function mapCandidateToCoreRequirements(
  requirements: JobRequirement[],
  matches: CandidateMatch[],
): RequirementEvidenceLink[] {
  const links: RequirementEvidenceLink[] = [];
  for (const requirement of requirements) {
    if (requirement.category !== "core") continue;
    const normalizedLabel = requirement.label.trim().toLowerCase();
    for (const match of matches) {
      const capabilityLabel = match.coreCoverage.evidenced.find((label) =>
        label.trim().toLowerCase() === normalizedLabel
      );
      if (!capabilityLabel) continue;
      const evidence = match.evidenceTrace.find((trace) =>
        trace.capability.trim().toLowerCase() === capabilityLabel.toLowerCase()
      );
      if (!evidence) continue;
      links.push({
        requirementId: requirement.requirementId,
        candidateId: match.candidate.id,
        capabilityLabel,
        evidenceSource: evidenceSource(evidence.source),
        matchStrength: "exact",
        candidateEvidenceText: evidence.evidence,
        requirementInterpretation: requirement.interpretedAs ?? requirement.label,
        reviewStatus: "supported",
      });
    }
  }
  return links;
}
