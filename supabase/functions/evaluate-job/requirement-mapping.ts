import type { CandidateMatch, JobRequirement } from "./types.ts";
import { CAPABILITY_UNITS } from "./qualification-evidence.ts";

export type RequirementAssessment = {
  requirementId: string;
  candidateId: string;
  status: "demonstrated" | "transferable" | "needs_validation" | "not_evidenced";
  requirementText: string;
  candidateEvidenceText: string | null;
  capabilityLabel: string | null;
  evidenceSource: "directory" | "enriched" | "resume" | "reviewer" | null;
  rationale: string;
  validationQuestion: string | null;
};

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

const ADJACENCIES: ReadonlyArray<{ target: string; evidence: string[]; explanation: string }> = [
  { target: "product strategy", evidence: ["software product delivery", "cross-functional leadership"], explanation: "Related product delivery or coordination experience; ownership of product strategy is unverified." },
  { target: "reporting and dashboards", evidence: ["data analysis"], explanation: "Data analysis may transfer to reporting; dashboard ownership is unverified." },
  { target: "data analysis", evidence: ["reporting and dashboards"], explanation: "Reporting experience may transfer to analysis; analytical depth is unverified." },
  { target: "cross-functional leadership", evidence: ["software product delivery"], explanation: "Product delivery may involve cross-functional coordination; leadership scope is unverified." },
  { target: "software product delivery", evidence: ["product strategy"], explanation: "Product strategy is related to product delivery; execution ownership is unverified." },
];
function normalize(s: string): string { return s.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim(); }
function sourceOf(source: CandidateMatch["evidenceTrace"][number]["source"]): NonNullable<RequirementAssessment["evidenceSource"]> {
  if (source === "resume_derived") return "resume";
  if (source === "enriched_skill" || source === "enriched_evidence") return "enriched";
  if (source === "reviewer_validated") return "reviewer";
  return "directory";
}
/** A conservative capability vocabulary: no title, industry, or generative inference is proof. */
function recognizedCapability(requirement: JobRequirement): string | null {
  const text = normalize(requirement.originalText);
  const direct = CAPABILITY_UNITS.filter(unit => unit.terms.some(term => {
    const pattern = normalize(term);
    return pattern.length > 2 && (" " + text + " ").includes(" " + pattern + " ");
  }));
  if (direct.length !== 1) return null; // Multi-capability requirements need individual review.
  return direct[0].label;
}
function question(requirement: JobRequirement): string {
  return `Can the candidate describe a specific example demonstrating: ${requirement.originalText.slice(0, 180)}?`;
}
/** Informational, not a qualification score or permission to relax employer requirements. */
export function assessCandidateRequirements(
  requirements: JobRequirement[],
  matches: CandidateMatch[],
  adjacentExperienceAllowed: boolean,
): RequirementAssessment[] {
  const relevant = requirements.filter(r => r.category === "core" || r.category === "preferred");
  const assessments: RequirementAssessment[] = [];
  for (const match of matches) {
    for (const requirement of relevant) {
      const capability = recognizedCapability(requirement);
      const normalized = normalize(capability ?? "");
      const direct = capability ? match.evidenceTrace.find(t => normalize(t.capability) === normalized && match.coreCoverage.evidenced.some(e => normalize(e) === normalized)) : undefined;
      if (direct) {
        assessments.push({
          requirementId: requirement.requirementId, candidateId: match.candidate.id,
          status: "demonstrated", requirementText: requirement.originalText,
          candidateEvidenceText: direct.evidence, capabilityLabel: direct.capability,
          evidenceSource: sourceOf(direct.source),
          rationale: "Documented evidence supports a recognized capability. Confirm scope and depth before referral.",
          validationQuestion: null,
        });
        continue;
      }
      const adjacency = capability && ADJACENCIES.find(a => normalize(a.target) === normalized);
      const adjacentTrace = adjacency && adjacentExperienceAllowed && requirement.acceptsAdjacentExperience === true && requirement.markedReviewed
        ? match.evidenceTrace.find(t => adjacency.evidence.some(c => normalize(c) === normalize(t.capability)) && match.coreCoverage.evidenced.some(e => normalize(e) === normalize(t.capability)))
        : undefined;
      // Do not infer equivalence from broad job titles, aspirational goals, or domain membership.
      const hasContext = match.candidate.formerJobTitle && requirement.category === "core"
        && normalize(match.candidate.formerJobTitle).split(" ").some(word => word.length >= 6 && normalize(requirement.originalText).split(" ").includes(word));
      const status: RequirementAssessment["status"] = adjacentTrace ? "transferable" : hasContext ? "needs_validation" : "not_evidenced";
      assessments.push({
        requirementId: requirement.requirementId, candidateId: match.candidate.id,
        status, requirementText: requirement.originalText,
        candidateEvidenceText: adjacentTrace?.evidence ?? null,
        capabilityLabel: adjacentTrace?.capability ?? null,
        evidenceSource: adjacentTrace ? sourceOf(adjacentTrace.source) : null,
        rationale: adjacentTrace ? adjacency!.explanation
          : hasContext ? "Overlapping role terminology is a lead for verification, not qualification evidence."
          : "No supporting evidence identified in the available candidate record; this does not establish absence of experience.",
        validationQuestion: status === "not_evidenced" ? null : question(requirement),
      });
    }
  }
  return assessments;
}
/** Compatibility adapter for existing response consumers. */
export function mapCandidateToCoreRequirements(
  requirements: JobRequirement[], matches: CandidateMatch[],
): RequirementEvidenceLink[] {
  return assessCandidateRequirements(requirements, matches, false)
    .filter(a => a.status === "demonstrated" && a.requirementId && a.capabilityLabel && a.candidateEvidenceText && a.evidenceSource)
    .map(a => ({
      requirementId: a.requirementId, candidateId: a.candidateId,
      capabilityLabel: a.capabilityLabel!, evidenceSource: a.evidenceSource!,
      matchStrength: "exact" as const, candidateEvidenceText: a.candidateEvidenceText!,
      requirementInterpretation: requirements.find(r => r.requirementId === a.requirementId)?.interpretedAs ?? a.capabilityLabel!,
      reviewStatus: "supported" as const,
    }));
}
