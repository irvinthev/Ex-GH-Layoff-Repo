import { CAPABILITY_UNITS } from "./qualification-evidence.ts";
import type { JobProfile, JobRequirement, JobRequirementUnit } from "./types.ts";

const HEADINGS: Array<{ pattern: RegExp; category: JobRequirement["category"] }> = [
  { pattern: /^(preferred|preferred qualifications|nice to have|bonus|bonus qualifications|desired qualifications)$/i, category: "preferred" },
  { pattern: /^(benefits|compensation(?: & benefits)?|what we offer|perks)$/i, category: "benefits" },
  { pattern: /^(about us|about the company|about (?!the role)\w.*|who we are|our company|company overview|company profile|our values|equal opportunity.*)$/i, category: "company_info" },
  { pattern: /^(about the role|the role|key responsibilities|responsibilities|what you.ll do|what you will do|your impact|who you are|what (?:we[’']re|we are) looking for|background & experience|qualifications|required qualifications|minimum qualifications|basic qualifications|requirements|what you.ll bring|what you.ll need|education|experience)$/i, category: "core" },
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim();
}

function sectionHeading(line: string): string {
  return line.trim().replace(/^\s*[-*•]\s*/, "").replace(/^#+\s*/, "").replace(/[:.!]+$/, "").trim();
}

function requirementLabels(originalText: string): string[] {
  const text = normalize(originalText);
  const specializedLabels = [
    /\benterprise saas pricing(?: experience)?\b/i,
    /\bcommercial monetization\b/i,
  ].flatMap((pattern) => {
    const match = originalText.match(pattern)?.[0]?.trim();
    return match ? [match] : [];
  });
  const labels = [
    ...CAPABILITY_UNITS.filter((unit) => unit.terms.some((term) => text.includes(normalize(term))))
      .map((unit) => unit.label.toLowerCase() === "sql" ? "SQL" : unit.label),
    ...specializedLabels,
  ];

  const experience = originalText.match(/\b\d+\+?\s+years?(?:\s+of)?\s+(?:relevant\s+)?experience\b/i)?.[0];
  if (experience) labels.push(experience);
  const seniority = originalText.match(/\b(intern|entry[- ]level|junior|associate|mid[- ]level|senior|lead|staff|principal|manager|director|executive|vp)[- ]level\b/i)?.[0];
  if (seniority) labels.push(seniority);
  const location = originalText.match(/\b(?:based in|located in|location:)\s+[^,.;]+/i)?.[0];
  if (location) labels.push(location);
  return [...new Map(labels.map((label) => [label.toLowerCase(), label])).values()];
}

function cleanLabel(originalText: string): string {
  return originalText
    .replace(/^\s*[-*•]\s*/, "")
    .replace(/\b(is )?(preferred|nice to have|a plus|not required)\b[.!]?/gi, "")
    .replace(/^\s*(experience with|experience in|knowledge of|familiarity with|proficiency in)\s+/i, "")
    .replace(/[.!;,\s]+$/, "")
    .trim()
    .slice(0, 180);
}

function splitText(value: string): string[] {
  return value.split(/\n+/).flatMap((line) =>
    line.split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
  ).map((part) => part.trim()).filter(Boolean);
}

export function parseJobRequirements(job: JobProfile): JobRequirement[] {
  const requirements: JobRequirement[] = [];
  let sourceSection = "Description";
  let sectionCategory: JobRequirement["category"] = "core";

  for (const line of job.description.split(/\n+/)) {
    const heading = sectionHeading(line);
    const matchedHeading = HEADINGS.find(({ pattern }) => pattern.test(heading));
    if (matchedHeading) {
      sourceSection = heading;
      sectionCategory = matchedHeading.category;
      continue;
    }
    if (/^[A-Z][A-Za-z &’'-]{1,50}:$/.test(heading) && !/https?:/i.test(heading)) {
      sourceSection = heading.slice(0, -1);
      sectionCategory = /preferred|bonus|nice to have|desired/i.test(heading)
        ? "preferred"
        : /benefit|offer|perk/i.test(heading)
          ? "benefits"
          : /about|company|culture|values/i.test(heading)
            ? "company_info"
            : "ambiguous";
      continue;
    }
    if (!line.trim()) continue;

    for (const originalText of splitText(line)) {
      const preferredWording = /\b(preferred|preferably|nice to have|a plus|bonus|ideally|not required|desired)\b/i.test(originalText);
      const labels = requirementLabels(originalText);
      const commercialMention = /\bcommercial monetization\b/i.test(originalText);
      let category = sectionCategory;
      if (sectionCategory === "core" && preferredWording) category = "preferred";
      if (sectionCategory === "core" && !labels.length && !preferredWording) category = "ambiguous";
      if (sectionCategory === "core" && commercialMention
        && !/\b(required|must(?: have)?|minimum|non[- ]negotiable)\b/i.test(originalText)) {
        category = "ambiguous";
      }
      for (const label of labels.length ? labels : [cleanLabel(originalText)]) {
        const ambiguityFlags: string[] = [];
        if (!labels.length) ambiguityFlags.push("unrecognized_requirement");
        if (/\b(familiarity|exposure|understanding|some experience|commercial monetization)\b/i.test(originalText)) {
          ambiguityFlags.push("unclear_scope");
        }
        if (/\b(or equivalent|equivalent experience|similar experience|commercial monetization)\b/i.test(originalText)) {
          ambiguityFlags.push("multiple_interpretations");
        }
        if (category === "ambiguous" && sectionCategory === "ambiguous") {
          ambiguityFlags.push("unclear_scope");
        }
        requirements.push({
          requirementId: `requirement-${requirements.length + 1}`,
          category,
          originalText,
          label,
          sourceSection,
          ambiguityFlags: [...new Set(ambiguityFlags)],
          markedReviewed: false,
        });
        if (requirements.length >= 300) return requirements;
      }
    }
  }
  if (job.seniority) {
    requirements.push({
      requirementId: `requirement-${requirements.length + 1}`,
      category: "core",
      originalText: job.title || job.seniority,
      label: `${job.seniority} seniority`,
      sourceSection: "Job title",
      ambiguityFlags: [],
      markedReviewed: false,
    });
  }
  if (job.location) {
    requirements.push({
      requirementId: `requirement-${requirements.length + 1}`,
      category: "core",
      originalText: job.location,
      label: `Location: ${job.location}`,
      sourceSection: "Job location",
      ambiguityFlags: [],
      markedReviewed: false,
    });
  }
  if (job.remoteType) {
    requirements.push({
      requirementId: `requirement-${requirements.length + 1}`,
      category: "core",
      originalText: job.remoteType,
      label: `Work model: ${job.remoteType}`,
      sourceSection: "Work model",
      ambiguityFlags: [],
      markedReviewed: false,
    });
  }
  return requirements;
}

export function parseJobRequirementUnits(job: JobProfile): JobRequirementUnit[] {
  return job.requirementsStructured.map((requirement) => {
    const unparsed = requirement.ambiguityFlags.length > 0;
    return {
      requirementId: requirement.requirementId,
      parsedCapability: unparsed ? null : requirement.label,
      adminConfirmedInterpretation: requirement.interpretedAs ?? null,
      parseStatus: unparsed ? "unparsed" : "parsed",
    };
  });
}

export function validateJobRequirementUnit(
  unit: JobRequirementUnit,
  requirement: JobRequirement,
  explicitAdminAction = false,
): boolean {
  if (!["core", "preferred", "company_info", "benefits", "ambiguous"].includes(requirement.category)) return false;
  if (typeof requirement.originalText !== "string" || !requirement.originalText.trim()
    || typeof requirement.label !== "string" || !requirement.label.trim()
    || !Array.isArray(requirement.ambiguityFlags)
    || typeof requirement.markedReviewed !== "boolean") return false;
  if (requirement.flexibility && !["mandatory", "flexible", "nice_to_have"].includes(requirement.flexibility)) return false;
  if (typeof unit.requirementId !== "string" || unit.requirementId !== requirement.requirementId) return false;
  if (unit.adminConfirmedInterpretation && !requirement.markedReviewed) return false;
  if (unit.adminConfirmedInterpretation !== (requirement.interpretedAs ?? null)) return false;
  if (requirement.category === "preferred" && requirement.flexibility === "mandatory"
    && (!explicitAdminAction || !requirement.markedReviewed)) return false;
  if (!["parsed", "unparsed"].includes(unit.parseStatus)) return false;
  return unit.parseStatus === "parsed" ? Boolean(unit.parsedCapability) : unit.parsedCapability === null;
}

export type JobRequirementReview = {
  requirements?: Array<{
    requirementId: string;
    interpretedAs?: string;
    flexibility?: JobRequirement["flexibility"];
    acceptsAdjacentExperience?: boolean;
    markedReviewed?: boolean;
  }>;
  topCapabilities?: string;
  adjacentExperience?: "yes" | "no" | "unsure";
  seniorityLocationFlexible?: "yes" | "no" | "unsure";
  skipped?: boolean;
};

export function applyJobRequirementReview(
  requirements: JobRequirement[],
  review: JobRequirementReview | null,
): JobRequirement[] {
  if (!review || review.skipped) return requirements.map((requirement) => ({ ...requirement }));
  const reviewedById = new Map((review.requirements ?? []).map((item) => [item.requirementId, item]));
  return requirements.map((requirement) => {
    const reviewItem = reviewedById.get(requirement.requirementId);
    if (!reviewItem || reviewItem.markedReviewed !== true) return { ...requirement };
    const flexibility = ["mandatory", "flexible", "nice_to_have"].includes(String(reviewItem.flexibility))
      ? reviewItem.flexibility
      : requirement.flexibility;
    const interpretedAs = String(reviewItem.interpretedAs ?? "").trim().slice(0, 300);
    return {
      ...requirement,
      ...(interpretedAs ? { interpretedAs } : {}),
      ...(flexibility ? { flexibility } : {}),
      ...(typeof reviewItem.acceptsAdjacentExperience === "boolean"
        ? { acceptsAdjacentExperience: reviewItem.acceptsAdjacentExperience }
        : {}),
      markedReviewed: true,
    };
  });
}
