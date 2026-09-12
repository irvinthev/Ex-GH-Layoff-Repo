import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  comparePostsByDateDesc,
  getResourceLinkLabel,
} = require("../resources.js");

test("sorts dated resources before undated or invalid entries", () => {
  const posts = [
    { title: "Undated", date: "" },
    { title: "Invalid", date: "not-a-date" },
    { title: "Older", date: "2024-01-15" },
    { title: "Newer", date: "2024-08-01" },
  ];

  const sortedTitles = [...posts]
    .sort(comparePostsByDateDesc)
    .map((post) => post.title);

  assert.deepEqual(
    sortedTitles,
    ["Newer", "Older", "Undated", "Invalid"]
  );
});

test("uses a YouTube label only for video resources", () => {
  assert.equal(
    getResourceLinkLabel({
      format: "video",
      url: "https://youtu.be/example"
    }),
    "Watch on YouTube →"
  );

  assert.equal(
    getResourceLinkLabel({
      format: "video",
      url: "https://vimeo.com/example"
    }),
    "Watch video →"
  );

  assert.equal(
    getResourceLinkLabel({
      format: "article",
      url: "https://www.linkedin.com/newsletters/example"
    }),
    "Read on LinkedIn →"
  );

  assert.equal(
    getResourceLinkLabel({
      url: "https://example.com/resource"
    }),
    "Open resource →"
  );

  assert.equal(
    getResourceLinkLabel({
      url: "https://youtu.be/example"
    }),
    "Open resource →"
  );
});
