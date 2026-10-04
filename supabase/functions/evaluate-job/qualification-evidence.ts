// Qualification units are job-defined, not candidate-label counts. The vocabulary
// is deliberately bounded; coverage is of recognized units, not the entire JD.
export type RequirementUnit = { label: string; terms: readonly string[] };

export const TECHNICAL_UNITS: RequirementUnit[] = [
  ...["java", "python", "javascript", "typescript", "react", "angular", "c#", ".net",
    "kotlin", "scala", "rust", "ruby", "php", "sql", "tableau", "power bi", "aws",
    "azure", "gcp", "kubernetes", "docker", "terraform", "microservices"]
    .map((term) => ({ label: term, terms: [term] })),
  { label: "node.js", terms: ["node.js", "nodejs"] },
  { label: "spring", terms: ["spring", "spring boot"] },
  { label: "backend", terms: ["backend", "back end"] },
  { label: "frontend", terms: ["frontend", "front end"] },
  { label: "full stack", terms: ["full stack"] },
];

export const CAPABILITY_UNITS: RequirementUnit[] = [
  ...TECHNICAL_UNITS,
  { label: "Data analysis", terms: ["data analysis", "data analytics", "analyze data", "analyze operational", "analyses", "analytics", "operational analysis"] },
  { label: "Reporting and dashboards", terms: ["dashboard", "dashboards", "reporting", "recurring reports", "queries and reports", "build reports", "maintain reports", "create reports", "scorecards"] },
  { label: "Spreadsheets", terms: ["excel", "google sheets", "spreadsheets"] },
  { label: "Data quality", terms: ["data quality", "data accuracy", "data validation"] },
  { label: "Data documentation", terms: ["document queries", "document reports", "data definitions", "data documentation"] },
  { label: "Communicating findings", terms: ["communicate findings", "communicating findings", "present findings", "presenting findings"] },
  ...["redash", "looker", "snowflake"].map((term) => ({ label: term, terms: [term] })),
];

/** Preserve heading boundaries before normalization. Unknown formats fall back
 * to their supplied text; never pretend this parser is a complete JD ontology. */
export function qualificationSections(description: string): { core: string; preferred: string } {
  const core: string[] = [];
  const preferred: string[] = [];
  let section: "core" | "preferred" | "context" = "core";
  for (const line of description.split(/\n+/)) {
    const heading = line.trim().replace(/[:.!]+$/, "").toLowerCase();
    if (/^(about us|about the company|company overview|benefits|our values|compensation|equal opportunity.*)$/.test(heading)) {
      section = "context";
      continue;
    }
    if (/^(about the role|the role|key responsibilities|responsibilities|what you.ll do|background & experience|qualifications|required qualifications|requirements|what you.ll bring)$/.test(heading)) {
      section = "core";
      continue;
    }
    if (/^(preferred|preferred qualifications|nice to have|bonus qualifications)$/.test(heading)) {
      section = "preferred";
      continue;
    }
    if (section === "context") continue;
    // Optional sentences in an otherwise unsectioned JD remain optional.
    for (const sentence of line.split(/(?<=[.!?])\s+/)) {
      (section === "preferred" || /\b(preferred|nice to have|a plus|not required)\b/i.test(sentence)
        ? preferred : core).push(sentence);
    }
  }
  return { core: core.join("\n"), preferred: preferred.join("\n") };
}

/** Only documented experience fields can resolve capability evidence. Arbitrary
 * JSON keys, interests, recommendations, file names and intent cannot score. */
export function qualificationEvidence(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const accepted = new Set(["summary", "resume_summary", "career_summary", "technical_skills",
    "core_tools", "verified_signals", "quantified_outcomes"]);
  const result: string[] = [];
  const strings = (entry: unknown): string[] => typeof entry === "string"
    ? [entry] : Array.isArray(entry) ? entry.flatMap(strings) : [];
  for (const [key, entry] of Object.entries(value)) {
    if (accepted.has(key)) result.push(...strings(entry));
    else if (key === "resume") result.push(...qualificationEvidence(entry));
    // Existing employment records carry a held title and dated evidence.
    else if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const record = entry as Record<string, unknown>;
      if (typeof record.title === "string" && typeof record.dates === "string") {
        result.push(record.title, ...strings(record.evidence));
      }
    }
  }
  return result;
}

export function qualificationNarrative(text: string): string {
  // Omit explicit intent/absence clauses rather than treating their keywords as
  // positive evidence. This is conservative text hygiene, not a semantic verifier.
  return text.split(/(?<=[.!?;])\s+|\n+/)
    .filter((sentence) => !/\b(targeting|seeking|looking (?:to|for)|interested in|aspir(?:e|ing)|want to|hop(?:e|ing) to|no (?:prior )?experience|lack(?:s|ing)? experience)\b/i.test(sentence))
    .join(" ");
}
