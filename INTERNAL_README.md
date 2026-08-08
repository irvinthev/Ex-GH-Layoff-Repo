# Internal README — Data Model & Maintenance

This internal README documents the data model used by the Ex-GH-Layoff-Repo static site, explains how the JSON data files are structured, provides validation and editing guidance, and lists recommended next steps and scripts to keep dataset quality high.

Files covered
- people.json — main dataset of former employees (profiles)
- placed.json — records of people who have been placed (hired/placed)
- posts.json — site posts or updates

Goals
- Describe each file's schema and fields, types, examples
- Provide validation recipes (JSON Schema + ajv) and developer commands
- Provide editing guidelines and privacy/security notes
- Provide suggested improvements and automation ideas

---

1) people.json — schema and notes

Overview
- An array of profile objects. Each object represents one person.
- Current file contains human-friendly keys with spaces (e.g., "First Name").
- Some records include spreadsheet formulas or placeholders in fields (e.g., Top 3 Skills contains `=AI("...")`) — these should be cleaned before publishing or used only as intermediate data.

Canonical field list (current):
- "First Name" (string) — given name or full preferred first name
- "Last Name" (string) — family name or full preferred last name
- "Former Job Title" (string) — their role at the former company
- "Former Team" (string) — team name(s)
- "Function" (string) — broader function / org area (Engineering, Product, Operations, etc.)
- "Location" (string) — human readable location; may include city, state, country or words like "Remote"
- "LinkedIn URL" (string) — URL to LinkedIn profile (may be missing or unnormalized)
- "Description" (string) — free-text bio / summary; may contain line breaks
- "Top 3 Skills" (string) — comma-separated list ideally, but file currently contains formula placeholders in many rows
- "Open to Work" (string) — "Yes" or other indicator; convert to boolean for validation/use
- "Date Added" (string) — currently empty; should be ISO 8601 date when populated

Recommended normalized schema (programmatic use)
- Use snake_case keys without spaces for consistent programmatic access.
- Convert boolean-like strings to booleans.
- Normalize LinkedIn URL to full https:// form or empty string/null.

Example normalized object (recommended):
{
  "first_name": "Sean",
  "last_name": "Zhang",
  "former_job_title": "Software Engineer I",
  "former_team": "Engineering",
  "function": "Engineering",
  "location": "Chicago, IL, USA",
  "linkedin_url": "https://www.linkedin.com/in/shaocheng-zhang-a03604220",
  "description": "Software Engineer building scalable backend and web applications\nBackend systems, APIs, full-stack development",
  "top_3_skills": ["Software Engineering","Technical Solutions","Customer Support"],
  "open_to_work": true,
  "date_added": "2026-08-08T12:00:00Z"
}

JSON Schema (recommended, simplified)
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "first_name": {"type": "string"},
    "last_name": {"type": "string"},
    "former_job_title": {"type": "string"},
    "former_team": {"type": "string"},
    "function": {"type": "string"},
    "location": {"type": "string"},
    "linkedin_url": {"type": ["string","null"], "format": "uri"},
    "description": {"type": "string"},
    "top_3_skills": {"type": "array", "items": {"type":"string"}, "maxItems": 3},
    "open_to_work": {"type": "boolean"},
    "date_added": {"type": ["string","null"], "format": "date-time"}
  },
  "required": ["first_name","last_name"]
}

Notes specific to people.json
- Some fields contain spreadsheet formulas or placeholders. Before using data in production or publishing, run a cleaning step to remove formulas and replace with actual values (or null).
- The "Top 3 Skills" field should be an array, not a formula or spreadsheet expression. If the source contains an AI-formula placeholder, convert it to concrete values or leave null.
- LinkedIn URL values are inconsistent: some are missing protocol ("www.linkedin.com/...") — normalize to https://
- Location values are free text. If you need structured location (city/state/country), consider adding separate fields or using a parsing/normalization script.

2) placed.json — schema and notes
- Contains records of people who have been placed/hired (likely subset of people.json). Structure may include:
  - first_name, last_name, placed_date, role, employer, location, notes, source

Recommendation: open placed.json and create a matching normalized schema (similar rules as people.json). Include a placed_date ISO 8601 field.

3) posts.json — schema and notes
- Small site posts/updates file. Validate fields such as id, title, date, body, tags, author

---

Editing and contribution guidelines (internal)
- Always edit the canonical source files (people.json, placed.json) in a branch and open a PR with a short description of changes.
- When adding or updating a record:
  - Fill 'Date Added' with ISO 8601 timestamp when the change is committed (e.g. 2026-08-08T12:00:00Z).
  - Ensure 'Top 3 Skills' is either an array or a comma-separated string that will be converted by the build pipeline.
  - Normalize LinkedIn URLs to a canonical https:// form; omit tracking query params.
  - Do not include private PII (personal emails, phone numbers) unless you have explicit consent. Remove or redact if present.

Suggested git workflow
1. Create feature branch: git checkout -b data/normalize-people
2. Run data normalization & validation locally (see scripts below)
3. Commit changes with a clear message and open a PR

Validation & tooling (recommended)
- Add a lightweight validation step in the dev workflow using ajv (for JSON Schema) or zod (if you use TypeScript).

Quick start (Node + ajv)
1) Add to project (suggested package.json additions):
  npm init -y
  npm install --save-dev ajv ajv-formats

2) Create a schema file (data/schemas/people.schema.json) using the sample above.

3) Validator script (scripts/validate-people.js):

const fs = require('fs');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const people = JSON.parse(fs.readFileSync('people.json', 'utf8'));
const schema = JSON.parse(fs.readFileSync('data/schemas/people.schema.json', 'utf8'));
const ajv = new Ajv({allErrors: true});
addFormats(ajv);
const validate = ajv.compile(schema);
let ok = true;
people.forEach((p, i) => {
  const obj = normalizeInput(p);
  const valid = validate(obj);
  if (!valid) {
    ok = false;
    console.error('Record', i, p['First Name'], p['Last Name'], validate.errors);
  }
});
if (!ok) process.exit(2);

function normalizeInput(raw) {
  // quick normalizer mapping legacy keys -> normalized keys used by schema
  return {
    first_name: raw['First Name'] || '',
    last_name: raw['Last Name'] || '',
    former_job_title: raw['Former Job Title'] || '',
    former_team: raw['Former Team'] || '',
    function: raw['Function'] || '',
    location: raw['Location'] || '',
    linkedin_url: normalizeLinkedIn(raw['LinkedIn URL']),
    description: raw['Description'] || '',
    top_3_skills: parseSkills(raw['Top 3 Skills']),
    open_to_work: parseBoolean(raw['Open to Work']),
    date_added: raw['Date Added'] || null
  };
}
function parseSkills(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.slice(0,3);
  // guard against spreadsheet formulas
  if (v.startsWith('=') || v.includes('AI("')) return [];
  return v.split(',').map(s => s.trim()).filter(Boolean).slice(0,3);
}
function parseBoolean(v) { return (String(v || '').toLowerCase() === 'yes'); }
function normalizeLinkedIn(u) {
  if (!u) return null;
  if (!u.startsWith('http')) return 'https://' + u.replace(/^www\./,'');
  return u.split('?')[0];
}

Run: node scripts/validate-people.js

Automation (CI)
- Add a GitHub Action step that runs the validation script on push/PR. Fail the check when validation fails.

Privacy & security
- Treat people.json as sensitive data if it contains personally identifying information. Consider restricting public access or redacting emails/phone numbers.
- If you plan to publish this site, ensure you have consent for publishing profiles and LinkedIn links.
- Keep backups and track who edited records in PR history.

Data cleaning recommendations
- Replace formula placeholders (e.g., Excel/Sheets `=AI(...)`) with extracted values before publishing.
- Convert 'Top 3 Skills' to arrays and limit to three items.
- Normalize 'Open to Work' to boolean.
- Populate 'Date Added' when adding new records.

Suggested file additions (small PRs)
- data/schemas/people.schema.json — JSON Schema for people.json
- scripts/validate-people.js — validation script
- package.json — scripts for validation and format checks ("validate:data": "node scripts/validate-people.js")
- .github/workflows/validate-data.yml — run validation on push/PR

Example next steps I can implement
- Add the JSON Schema and validation script and open a PR.
- Add a small normalization script that rewrites people.json into a normalized people.normalized.json for the site to consume.
- Add an internal CONTRIBUTORS.md and update README with data editing rules.

If you want I can create a branch and open a PR with:
- data/schemas/people.schema.json
- scripts/validate-people.js
- INTERNAL_README.md (this file)
- package.json with validation scripts

Tell me which pieces to create as a PR and I will add them.