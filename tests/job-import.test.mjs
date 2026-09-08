import test from "node:test";
import assert from "node:assert/strict";
import {
  extractJobPostingHtml,
  validatePublicJobUrl,
} from "../supabase/functions/evaluate-job/job-import.ts";

test("extracts a structured JobPosting", () => {
  const html = `<!doctype html><html><head>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        "title": "Senior Product Manager",
        "description": "<p>Lead product strategy, customer discovery, roadmap planning, and cross-functional delivery for a marketplace platform.</p>",
        "jobLocation": {"address": {"addressLocality": "Boston", "addressRegion": "MA"}}
      }
    </script>
  </head><body></body></html>`;

  const job = extractJobPostingHtml(html, "https://jobs.example.com/123");
  assert.equal(job.title, "Senior Product Manager");
  assert.equal(job.location, "Boston, MA");
  assert.equal(job.sourceMode, "structured");
  assert.match(job.description, /product strategy/);
});

test("rejects local and private URL targets", () => {
  assert.throws(() => validatePublicJobUrl("http://example.com/job"), /https/);
  assert.throws(() => validatePublicJobUrl("https://127.0.0.1/job"), /public website/);
  assert.throws(() => validatePublicJobUrl("https://192.168.1.2/job"), /public website/);
  assert.throws(() => validatePublicJobUrl("https://metadata.google.internal/job"), /public website/);
});
