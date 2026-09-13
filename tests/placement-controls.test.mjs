import test from "node:test";
import assert from "node:assert/strict";
import { sortAndFilterMatches } from "../placement-utils.js";
import { wireResultControls } from "../placement-controls.js";

class FakeControl {
  constructor(value = "") {
    this.value = value;
    this.listeners = new Map();
    this.attributes = new Map();
    this.classListSet = new Set();
    this.classList = {
      toggle: (name, enabled) => {
        if (enabled) this.classListSet.add(name);
        else this.classListSet.delete(name);
      },
      contains: (name) => this.classListSet.has(name),
    };
  }

  addEventListener(type, handler) {
    this.listeners.set(type, handler);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  trigger(type) {
    this.listeners.get(type)?.();
  }
}

test("sort selection updates rendered match order through control callback", () => {
  const sortSelect = new FakeControl("score_desc");
  const filterAll = new FakeControl();
  const filterStrong = new FakeControl();
  const matches = [
    { score: 92, candidate: { name: "Taylor" } },
    { score: 55, candidate: { name: "Alex" } },
    { score: 70, candidate: { name: "Jordan" } },
  ];

  let visible = sortAndFilterMatches(matches, "score_desc", "all");
  wireResultControls({
    sortSelect,
    filterAllButton: filterAll,
    filterStrongButton: filterStrong,
    onChange: ({ sort, filter }) => {
      visible = sortAndFilterMatches(matches, sort, filter);
    },
  });

  sortSelect.value = "name_asc";
  sortSelect.trigger("change");
  assert.deepEqual(visible.map((match) => match.candidate.name), ["Alex", "Jordan", "Taylor"]);
});

test("strong-filter click updates aria state and can produce empty result set", () => {
  const sortSelect = new FakeControl("score_desc");
  const filterAll = new FakeControl();
  const filterStrong = new FakeControl();
  const matches = [{ score: 45, candidate: { name: "Casey" } }];

  let visible = matches;
  wireResultControls({
    sortSelect,
    filterAllButton: filterAll,
    filterStrongButton: filterStrong,
    onChange: ({ sort, filter }) => {
      visible = sortAndFilterMatches(matches, sort, filter);
    },
  });

  filterStrong.trigger("click");
  assert.equal(filterStrong.getAttribute("aria-pressed"), "true");
  assert.equal(filterAll.getAttribute("aria-pressed"), "false");
  assert.equal(filterStrong.classList.contains("is-active"), true);
  assert.equal(visible.length, 0);
});
