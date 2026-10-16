# Function category normalization

The directory has 13 distinct function labels after combining the formatting variants
`Marketing/Communications` and `Marketing / Communications` into
`Marketing / Communications` (three profiles). Candidate count remains 91.

The hourly CSV-to-JSON refresh calls `scripts.normalize_categories.normalize_function`
before publishing people.json. Known labels use canonical capitalization, whitespace,
and slash/ampersand spacing. Unknown functions remain intact apart from whitespace
and separator cleanup; they are not assigned to an inferred category. Product and
Product Design, and Go to Market and Sales / Business Development, remain distinct.

Existing shared URLs using the old slash spacing still select the canonical function.
This change does not edit the connected source spreadsheet, descriptions, skills,
candidate consent, or publication gates.

Verification: 99 Node tests, 59 Chromium browser assertions, and existing JSON schema
validation pass. The browser checks confirm a single marketing filter, all three
marketing profiles in that bucket, and restoration of the legacy marketing URL.
An independent data comparison confirms only one Function value changed, with all
other candidate fields and the number/order of records preserved.
