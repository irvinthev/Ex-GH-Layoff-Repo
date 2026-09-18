import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pages = [
  "index.html",
  "about.html",
  "resources.html",
  "layoff-guide.html",
  "placement.html",
];

const independenceStatement =
  "Ex-GH Talent Network is an independent, alumni-led community for former Grubhub employees. It is not affiliated with, sponsored by, endorsed by, or operated by Grubhub.";

test("site footer includes the independence statement on every html page", () => {
  for (const page of pages) {
    const html = readFileSync(new URL(`../${page}`, import.meta.url), "utf8");
    const navIndex = html.indexOf('class="site-footer-nav"');
    const noteIndex = html.indexOf(independenceStatement);

    assert.match(html, /class="site-footer"/, `${page} should include the shared site footer`);
    assert.match(html, /class="site-footer-nav"/, `${page} should include footer navigation`);
    assert.notEqual(noteIndex, -1, `${page} should include the independence statement`);
    assert.ok(navIndex < noteIndex, `${page} should place the independence statement beneath the footer navigation`);
  }
});
