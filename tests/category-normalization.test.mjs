import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
function normalize(values) {
  return JSON.parse(execFileSync("python3", ["-c", `
import json, sys
from scripts.normalize_categories import normalize_function
print(json.dumps([normalize_function(v) for v in json.load(sys.stdin)]))
`], { cwd: root, input: JSON.stringify(values), encoding: "utf8" }));
}

test("equivalent spelling, case, and whitespace use one function label", () => {
  assert.deepEqual(normalize(["Marketing/Communications", " marketing /  communications ",
    "DATA&ANALYTICS", "Customer Care&Support", "Legal/Risk/Compliance", "engineering"]),
  ["Marketing / Communications", "Marketing / Communications", "Data & Analytics",
    "Customer Care & Support", "Legal / Risk / Compliance", "Engineering"]);
});

test("normalization preserves unknown categories and does not merge distinct functions", () => {
  assert.deepEqual(normalize(["Go to Market", "Sales / Business Development", "Product",
    "Product Design", "  New   Specialty ", "", null]),
  ["Go to Market", "Sales / Business Development", "Product", "Product Design", "New Specialty", "", ""]);
});

test("published function labels are canonical and normalization is idempotent", () => {
  const people = JSON.parse(readFileSync(new URL("../people.json", import.meta.url), "utf8"));
  const labels = people.map(person => person.Function);
  assert.deepEqual(normalize(labels), labels);
  assert.deepEqual(normalize(normalize(labels)), labels);
  const marketing = labels.filter(label => label === "Marketing / Communications");
  assert.ok(marketing.length > 1, "both marketing variants should share the canonical bucket");
});

test("hourly data refresh applies normalization before writing public records", () => {
  const workflow = readFileSync(new URL("../.github/workflows/update-data.yml", import.meta.url), "utf8");
  assert.match(workflow, /from scripts\.normalize_categories import normalize_function/);
  assert.match(workflow, /row\["Function"\] = normalize_function\(row\["Function"\]\)/);
});
