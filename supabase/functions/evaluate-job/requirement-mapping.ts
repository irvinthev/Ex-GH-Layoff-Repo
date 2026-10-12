import type { CandidateMatch, JobRequirement } from "./types.ts";
import { CAPABILITY_UNITS } from "./qualification-evidence.ts";

export type RequirementAssessment = {
  requirementId: string; candidateId: string;
  status: "demonstrated" | "reported" | "transferable" | "needs_validation" | "not_evidenced";
  requirementText: string; reviewedInterpretation: string | null;
  candidateEvidenceText: string | null; capabilityLabel: string | null;
  evidenceSource: "directory" | "enriched" | "resume" | "reviewer" | null;
  evidenceType: string | null; rationale: string; validationQuestion: string | null;
};
export type RequirementEvidenceLink = {
  requirementId: string; candidateId: string; capabilityLabel: string;
  evidenceSource: "directory" | "enriched" | "resume" | "reviewer";
  matchStrength: "exact" | "adjacent" | "interpretable" | "contextual" | undefined;
  candidateEvidenceText: string; requirementInterpretation: string;
  reviewStatus: "supported" | "gaps" | "adjacent_field" | "unvalidated";
};
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim();
const clean = (s: string) => normalize(s).replace(/\s+/g, " ");
const sources = (source: string): NonNullable<RequirementAssessment["evidenceSource"]> =>
  source === "resume_derived" ? "resume" : source === "reviewer_validated" ? "reviewer"
    : source.startsWith("enriched") ? "enriched" : "directory";
const isReported = (source: string) => source === "public_skill" || source === "enriched_skill";
const containsPhrase = (haystack: string, phrase: string) => (" " + clean(haystack) + " ").includes(" " + clean(phrase) + " ");
const recognized = (s: string) => CAPABILITY_UNITS.filter(unit =>
  unit.terms.some(term => containsPhrase(s, term)) || clean(unit.label) === clean(s)).map(u => u.label);
function capability(r: JobRequirement): string | null {
  // Parser emits a distinct label per capability even when the source sentence mentions several.
  const fromLabel = CAPABILITY_UNITS.find(u => clean(u.label) === clean(r.label));
  if (fromLabel) return fromLabel.label;
  // A confirmed interpretation may clarify an unknown requirement; never rewrite employer wording.
  if (r.markedReviewed && r.interpretedAs) {
    const interpretation = recognized(r.interpretedAs);
    if (interpretation.length === 1) return interpretation[0];
  }
  const matches = recognized(r.originalText);
  return matches.length === 1 ? matches[0] : null;
}
const question = (r: JobRequirement) => `Can you give a specific work example supporting "${(r.interpretedAs && r.markedReviewed ? r.interpretedAs : r.originalText).slice(0,160)}", including your role and outcome?`;
const traceFor = (m: CandidateMatch, cap: string, preferred: boolean) => {
  const evidenced = preferred ? [...m.coreCoverage.evidenced, ...m.coreCoverage.preferredEvidenced] : m.coreCoverage.evidenced;
  if (!evidenced.some(x => clean(x) === clean(cap))) return undefined;
  return m.evidenceTrace.find(t => clean(t.capability) === clean(cap));
};
const documented = (source: string) => !isReported(source) && source !== "held_title" && source !== "directory_team";
/**
 * Shadow-only assessment: conservative exact evidence, no speculative industry equivalence.
 * Adjacent hypotheses require an individually reviewed admin interpretation identifying an
 * evidenced capability distinct from the requirement, plus global and per-requirement consent.
 */
export function assessCandidateRequirements(requirements: JobRequirement[], matches: CandidateMatch[], adjacentAllowed: boolean): RequirementAssessment[] {
  const relevant = requirements.filter(r => r.category === "core" || r.category === "preferred");
  const output: RequirementAssessment[] = [];
  for (const m of matches) for (const r of relevant) {
    const cap = capability(r);
    const direct = cap ? traceFor(m, cap, r.category === "preferred") : undefined;
    const reviewed = r.markedReviewed && r.interpretedAs ? r.interpretedAs : null;
    let status: RequirementAssessment["status"] = "not_evidenced";
    let evidence = direct;
    let rationale = "No supporting evidence identified in the available candidate record; absence is not established.";
    if (direct) {
      status = documented(direct.source) ? "demonstrated" : "reported";
      rationale = status === "reported" ? "Capability is listed or title-derived; execution and depth require verification."
        : "Documented capability evidence exists; verify responsibility and depth.";
    } else if (adjacentAllowed && r.markedReviewed && r.acceptsAdjacentExperience === true && reviewed) {
      // Explicit admin interpretation of adjacent experience is a hypothesis, not equivalence.
      const other = recognized(reviewed).filter(x => !cap || clean(x) !== clean(cap));
      if (other.length === 1) {
        const candidateTrace = traceFor(m, other[0], r.category === "preferred");
        if (candidateTrace) {
          evidence = candidateTrace;
          status = documented(candidateTrace.source) ? "transferable" : "needs_validation";
          rationale = "Admin-authorized adjacent capability hypothesis; direct requirement ownership is not established.";
        }
      }
    }
    output.push({
      requirementId:r.requirementId, candidateId:m.candidate.id, status,
      requirementText:r.originalText, reviewedInterpretation:reviewed,
      candidateEvidenceText:evidence?.evidence ?? null,
      capabilityLabel:evidence?.capability ?? cap,
      evidenceSource:evidence ? sources(evidence.source) : null,
      evidenceType:evidence?.source ?? null, rationale,
      validationQuestion:status === "demonstrated" ? null : question(r),
    });
  }
  return output;
}
/** Preserve the Phase 2 PR1 legacy contract: core only, literal label-to-core evidence. */
export function mapCandidateToCoreRequirements(requirements: JobRequirement[], matches: CandidateMatch[]): RequirementEvidenceLink[] {
  const links: RequirementEvidenceLink[] = [];
  for (const r of requirements) {
    if (r.category !== "core") continue;
    for (const m of matches) {
      const cap = m.coreCoverage.evidenced.find(label => clean(label) === clean(r.label));
      if (!cap) continue;
      const trace = m.evidenceTrace.find(t => clean(t.capability) === clean(cap));
      if (!trace) continue;
      links.push({ requirementId:r.requirementId, candidateId:m.candidate.id,
        capabilityLabel:cap, evidenceSource:sources(trace.source), matchStrength:"exact",
        candidateEvidenceText:trace.evidence, requirementInterpretation:r.interpretedAs ?? r.label,
        reviewStatus:"supported" });
    }
  }
  return links;
}
