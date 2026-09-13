import test from "node:test";
import assert from "node:assert/strict";
import {
  getFitTone,
  getSummaryStats,
  sortAndFilterMatches,
} from "../placement-utils.js";

const matches = [
  { score: 82, fitBand: "Strong fit", candidate: { name: "Taylor" } },
  { score: 58, fitBand: "Review", candidate: { name: "Alex" } },
  { score: 71, fitBand: "Moderate fit", candidate: { name: "Jordan" } },
];

test("filters to strong fits and sorts by score", () => {
  const visible = sortAndFilterMatches(matches, "score_desc", "strong");
  assert.deepEqual(visible.map((match) => match.candidate.name), ["Taylor"]);
});

test("sorts names alphabetically when requested", () => {
  const visible = sortAndFilterMatches(matches, "name_asc", "all");
  assert.deepEqual(visible.map((match) => match.candidate.name), ["Alex", "Jordan", "Taylor"]);
});

test("calculates fit-tone and summary distribution", () => {
  assert.equal(getFitTone(matches[0]), "strong");
  assert.equal(getFitTone(matches[1]), "review");

  const summary = getSummaryStats(matches);
  assert.equal(summary.strong, 1);
  assert.equal(summary.moderate, 1);
  assert.equal(summary.review, 1);
  assert.equal(summary.averageScore, 70);
});
