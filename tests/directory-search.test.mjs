import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { matches } = createRequire(import.meta.url)("../directory-search.js");

test("all keywords match across fields regardless of order", () => {
  assert.ok(matches("software Chicago", ["Software Engineer", "Engineering", "Chicago, IL"]));
  assert.ok(matches("CHICAGO software", ["Software Engineer", "Chicago, IL"]));
  assert.equal(matches("software Boston", ["Software Engineer", "Chicago, IL"]), false);
});
test("seniority abbreviations work without rewriting candidate titles", () => {
  assert.ok(matches("Senior Manager Finance Systems", ["Sr Manager of Finance Systems", "Finance/IT"]));
  assert.ok(matches("sr. manager", ["Senior Manager"]));
});
test("quoted phrases require contiguous text while other keywords match separately", () => {
  assert.ok(matches('"finance systems" ERP', ["Sr Manager of Finance Systems", "ERP transformation"]));
  assert.equal(matches('"finance manager"', ["Finance Systems Manager"]), false);
});
test("empty searches match; technical punctuation is preserved and impossible terms fail", () => {
  assert.ok(matches("   ", ["Any role"]));
  assert.ok(matches("C++", ["C++ developer"]));
  assert.equal(matches("C++", ["C developer"]), false);
  assert.equal(matches('<img src=x onerror=alert(1)>', ["Engineering"]), false);
});
