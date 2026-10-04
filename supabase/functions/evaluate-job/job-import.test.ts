import { extractJobPostingHtml } from "./job-import.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("LinkedIn importer isolates the actual job description from unrelated page content", () => {
  const html = `
    <html>
      <head><title>Calibrate hiring Junior Data Analyst | LinkedIn</title></head>
      <body>
        <div class="show-more-less-html__markup">
          <p>Use SQL to analyze business performance, build dashboards, track KPIs, and create recurring reports.</p>
          <p>Experience with Tableau or Power BI is preferred. Python is a plus.</p>
        </div>
        <section class="recommended-jobs">
          <p>Technical Product Management</p>
          <p>Education Technology</p>
          <p>Cross-functional leadership</p>
        </section>
      </body>
    </html>`;

  const result = extractJobPostingHtml(
    html,
    "https://www.linkedin.com/jobs/view/4460477929/",
  );

  assert(result.description.includes("Use SQL"), "Actual LinkedIn job description was not extracted");
  assert(!result.description.includes("Technical Product Management"), "Recommended-job page chrome leaked into the job description");
  assert(!result.description.includes("Education Technology"), "Unrelated LinkedIn page content leaked into the job description");
});
