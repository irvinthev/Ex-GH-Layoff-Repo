import test from "node:test";
import assert from "node:assert/strict";
import {
  getFitTone,
  getEvidenceCategory,
  getSummaryStats,
  sortAndFilterMatches,
} from "../placement-utils.js";

const matches = [
  { score: 82, fitBand: "Strong fit", candidate: { name: "Taylor" } },
  { score: 58, fitBand: "Review", candidate: { name: "Alex" } },
  { score: 71, fitBand: "Moderate fit", candidate: { name: "Jordan" } },
  { score: 45, fitBand: "Strong fit", candidate: { name: "Casey" } },
];

test("filters to strong fits and sorts by score", () => {
  const visible = sortAndFilterMatches(matches, "score_desc", "strong");
  assert.deepEqual(visible.map((match) => match.candidate.name), ["Taylor"]);
});

test("strong filter uses score threshold regardless of fit-band text", () => {
  const belowThresholdStrongBand = sortAndFilterMatches([matches[3]], "score_desc", "strong");
  assert.equal(belowThresholdStrongBand.length, 0);
});

test("sorts names alphabetically when requested", () => {
  const visible = sortAndFilterMatches(matches, "name_asc", "all");
  assert.deepEqual(visible.map((match) => match.candidate.name), ["Alex", "Casey", "Jordan", "Taylor"]);
});

test("sorts scores ascending when requested", () => {
  const visible = sortAndFilterMatches(matches, "score_asc", "all");
  assert.deepEqual(visible.map((match) => match.score), [45, 58, 71, 82]);
});

test("calculates fit-tone and summary distribution", () => {
  assert.equal(getFitTone(matches[0]), "strong");
  assert.equal(getFitTone(matches[1]), "moderate");
  assert.equal(getFitTone(matches[3]), "review");

  const summary = getSummaryStats(matches);
  assert.equal(summary.strong, 1);
  assert.equal(summary.moderate, 2);
  assert.equal(summary.review, 1);
  assert.equal(summary.averageScore, 64);
});

test("evidence categories require demonstrated support and do not use score or compatibility", () => {
  const candidates = [
    { score: 95, fitBand: "Strong", evidenceAssessment: { strength: "Thin" } },
    { score: 61, fitBand: "Possible", evidenceAssessment: { strength: "Supported" }, compatibility: { overall: "mismatch" } },
    { score: 80, fitBand: "Strong" },
  ];

  assert.deepEqual(candidates.map(getEvidenceCategory), ["validation", "ranked", "validation"]);
  assert.equal(candidates.length, 3);
});
