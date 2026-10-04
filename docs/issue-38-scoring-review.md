# Issue 38: JD evidence scoring review

Status: Ready with qualifications for code review. Implemented and replayed locally; not deployed. Existing full-suite failures remain. These scores measure recorded evidence, not hiring suitability or probability of success.

## Evidence and reproduction

- Reviewed issue https://github.com/irvinthev/Ex-GH-Layoff-Repo/issues/38 (no comments at retrieval).
- Baseline repository: `cc8ddbddf2564bbb128010e599922222acd38475`.
- Read deployed evaluate-job version 29; candidate-cache.ts differs from baseline only by trailing whitespace.
- Retrieved authorized candidate-cache rows and active role taxonomy read-only. Merged those rows with the unchanged public people.json using the production merge function. DB is directory-only; the other four have enriched rows. Public directory fields override enriched public descriptions, titles and public skills when nonempty.
- Retrieved the live LinkedIn HTML for job 4460477929 and ran the existing importer. It selected the dedicated description container (sourceMode page_text), not recommended jobs. Actual description includes company context, responsibilities, required experience, Preferred, Benefits, and values.
- Reproduced all five scores AND component scores from saved run `b68f31b3-0146-4ff3-b026-3007f4473f72`, created 2026-10-04 23:16:02 UTC. The saved run does not persist the original JD; same-input historical replay cannot be proven beyond the exact matching score/component results using the freshly retrieved JD and current rows.
- Private enriched records and the full JD were used locally, not added to the public repository.

## Pre-change findings and decision

Root cause is candidate-label counting plus overly permissive evidence matching, not an explicit L3 bonus or a seniority penalty. All five candidates receive 24 role points and zero title points. Changing their common role weight alone cannot explain or fix their relative ordering.

The proposed invariant, stated before implementation: **One evidenced JD capability earns credit once, regardless of the number of synonymous profile labels or source layers. Context, preferences and unrelated technical evidence cannot manufacture core credit.**

Expected direction before implementation: DB gains relative to PDL and EM; KP loses preferred-tool and context advantages; CC retains direct support but loses inflated domain points. No individual-specific rules, new scoring weights, band adjustments or public-directory edits were proposed.

### Exact original point trace

Final score = `Math.round((role + title + skills + domain) / 80 * 100)`.

| Candidate | Role /30 | Title /15 | Skills /20 | Domain /15 | Raw /80 | Score | Seniority /10 (excluded) | Location /10 (excluded) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| CC | 24 | 0 | 20 | 15 | 59 | 74 | 7 | 10 |
| PDL | 24 | 0 | 12 | 12 | 48 | 60 | 0 | 10 |
| KP | 24 | 0 | 18 | 4 | 46 | 57 | 0 | 10 |
| EM | 24 | 0 | 18 | 0 | 42 | 53 | 0 | 10 |
| DB | 24 | 0 | 18 | 0 | 42 | 53 | 0 | 10 |

EM appears before DB on a tie because the score-only stable sort preserves candidate input order. It is not an additional qualification preference.

- **DB:** three profile skill labels contribute 6 each: SQL Querying, Data Analysis, Dashboard Building. His Redash/reporting narrative resolves technical/concept evidence but does not independently create a skill entry. No domains. Redash is not expressly named in this JD; its relevance is BI-tool experience, not an exact required-tool match.
- **PDL:** Data Analysis and Analytics contribute 12, although these describe substantially the same capability. SQL/Python exist in resume technical evidence, but are not feature/public skill entries. Three domain labels contribute 4 each: Education Technology, Mission-Driven Technology, Healthcare Access. None is an exact phrase in the JD. Separate words across the whole description satisfy token overlap; these points do not establish analyst-task capability. Healthcare relevance may be useful context, but the JD makes clinical/healthcare exposure preferred, and the candidate field also includes positioning/interests rather than uniformly documented work.
- **KP:** SQL, Tableau and Advanced Excel contribute 18. SQL and spreadsheets are directly relevant required experience; Tableau is preferred. Operations contributes 4 exact domain points. She has relevant evidence, not merely a rich profile; the old score failed to distinguish required from preferred evidence.
- **EM:** SQL, Python and Operations contribute 18. Python is preferred. Operations becomes a *core skill* because the filter checks `includesPhrase(candidate.evidenceNormalized, term)` inside the loop for every matched skill. Once ANY technical term matches the candidate, this clause is true for every otherwise matched skill. SQL evidence cannot justify six core points for Operations.
- **CC:** SQL, Tableau, Excel, Python and Data Analysis reach the 20-point skill cap. Domains Data Analytics, Business Intelligence, Support Operations and Business Operations reach the 15-point cap. Only Business Intelligence is an exact phrase; it occurs in Preferred. The others match dispersed words. His SQL, Excel, analysis and dashboard evidence are substantial, so DB should not automatically outrank him.

## Full scoring path

1. **job-import.ts:** JSON-LD description first, then LinkedIn dedicated description container, then whole-page/meta fallbacks. Existing provider isolation prevents recommended-job contamination for this live page. It does not separate responsibilities from company/benefits text. The existing short-container test also exposed a 200-character provider threshold that could discard a valid short JD and admit page chrome.
2. **candidate-cache.ts merge:** identity resolution joins public and enriched sources. Public fields are preferred; enriched skills/domains/evidence are retained. Cache lasts one hour.
3. **buildCandidateProfile:** formerly flattened all JSON keys/values and domains into one evidence string; sources, file names, motivators and best-fit suggestions could therefore supply capability keywords. Explicit preference fields were already excluded, but intent inside free text/JSON was not.
4. **prepareJobProfile / classifyRole:** title and description classify Data Analytics. Generic title words are removed for title specialty scoring; all five score zero here. Old atomic vocabulary used unstemmed analytics/analysis while tokenization yields `analytic`, creating inconsistent matching, often masked by the global technical-match leak.
5. **scoreCandidate:** old skills count matching candidate labels; role can jump to 24 from two incidental skill matches or a skill plus a generic concept; domain counts labels matched by whole-description token overlap. Role/title/skills/domain alone form the score.
6. **evidence-layers.ts:** L1/L2/L3 depth is descriptive, never added to score. Band support checks can downgrade a recommendation using role/capability/technical evidence, independently of evidence depth. All five original matches satisfy technical support. The function does not reorder results.
7. **index.ts:** attaches evidence metadata, sorts descending by numeric score, persists result snapshot. Existing thresholds are 75 Strong / 55 Possible. No change to those thresholds, ranking formula, validation inputs, merge logic, or public directory behavior.

## Implemented change

- Replaced candidate-label core counting with distinct, bounded JD capability units; the existing six points per unit and 20-point skill cap remain. SQL synonyms/labels cannot multiply points; reporting and dashboards form one delivery capability. Narrative and approved resume evidence can resolve the same units as public skills.
- Added `coreCoverage` to CandidateMatch: recognized units, evidenced units, not-evidenced units, ratio (null when no units are recognized), and preferred evidence. **This is recognized-vocabulary coverage, not a complete requirements assessment.** No UI changes are included.
- Separated explicit core/preferred/company/benefits sections before matching. Optional evidence remains explanatory and does not become core points. Only core technical terms set the technical support gate; SQL is the relevant gate here, not preferred Python/Tableau.
- Removed global technical promotion and token-bag domain matches. Domain points require a distinct exact phrase in core JD text; contextual skills remain capped at two points and cannot establish role-family capability by themselves.
- Read approved factual JSON fields/dated employment evidence rather than stringifying arbitrary keys/metadata. Excluded explicit intent sentences. Domain labels no longer supply core capability evidence.
- Preserved heading line breaks in HTML extraction and accepted a dedicated LinkedIn description at the same 50-character minimum already used for a valid JD. Fixed sentence-terminal periods hiding exact terms while preserving dotted technology names.
- Updated methodology text to v18. `evidence-layers.ts` was inspected and behavior tested, but did not require a code change.

## Verified after-change trace

| Candidate | Role | Title | Skills | Domain | Raw /80 | Before → after | Band after | Recognized core coverage |
|---|---:|---:|---:|---:|---:|---:|---|---|
| CC | 24 | 0 | 20 | 0 | 44 | 74 → 55 | Possible | 4/7: SQL, analysis, reporting/dashboards, spreadsheets |
| DB | 24 | 0 | 18 | 0 | 42 | 53 → 53 | Exploratory | 3/7: SQL, analysis, reporting/dashboards |
| KP | 24 | 0 | 12 | 4 | 40 | 57 → 50 | Exploratory | 2/7: SQL, spreadsheets |
| PDL | 24 | 0 | 12 | 0 | 36 | 60 → 45 | Exploratory | 2/7: SQL, analysis |
| EM | 24 | 0 | 7 | 0 | 31 | 53 → 39 | Exploratory | 1/7: SQL; plus one contextual Operations point |

The other recognized units are data quality, data documentation, and communicating findings. These are not explicitly resolved by the current lexical evidence model for these candidates; no claim is made that they lack those capabilities. Python/Tableau remain visible as preferred evidence where recorded.

Original ordering: CC > PDL > KP > EM = DB.
New ordering: CC > DB > KP > PDL > EM.

## Answers to the architectural questions / remaining risk

1. **Role-family generosity: yes.** Previously two incidental labels could generate 24 points; that route is removed. Genuine but limited capability can still yield 24, and exact role phrases/function/title paths remain coarse. All five retain 24. A graded role scale needs a multi-role validation set; this case alone does not justify new weights.
2. **Indirect enrichment advantage: yes, originally.** Repeated skill concepts, broad domain arrays and arbitrary JSON text created routes to points. Core units, exact core-domain phrases and approved evidence fields substantially narrow these. Enrichment can legitimately increase scores when it adds new, relevant documented evidence; adding a source marker or repeating the same core capability cannot.
3. **Core responsibilities versus context:** the old model could let three spurious domain labels overpower stronger core evidence. The fix corrects that ordering without changing weights. It does not establish that 30/15/20/15 is optimal. Title and domain weight, and skill saturation at four units, remain calibration questions.
4. **Separate core coverage: yes.** Added as an auditable diagnostic. It is not a calibrated fit percentage, and it is not the sole sort key. Scoring the entire JD proportionately would require fuller extraction, handling alternatives, mandatory versus preferred distinctions, and evidence quality/provenance validation.
5. **Remaining richness pathways:** real additional qualification evidence can still change ranking. Contextual skill labels (up to two points) and exact core-domain labels (up to 15) remain source-structured scoring paths; richer source records can expose more such matches. The fix removes the demonstrated false matches rather than claiming universal representation invariance for every contextual/domain synonym. These residual weights should be tested across multiple jobs before a wider redesign. Explicitly stored intent fields and tested intent/metadata examples remain score-neutral, but free-text semantic intent/negation is not comprehensively understood by a regex.

### Regression and evidence limitations

- Section detection is heading/sentence-based; unusual or flattened headings can misclassify text. Unknown formats use supplied text. Whole-page fallback remains available when no description is recognized and may need separate hardening.
- Capability vocabulary is deliberately bounded. Some valid synonyms or detailed accomplishments will be unrecognized. Bare `direct reports` is not report-building evidence. Tool mention does not prove proficiency or task ownership.
- The approved enrichment field list is conservative; new schemas require explicit mapping and tests. Existing structured skills are accepted as source assertions, not independently verified credentials.
- Preferred evidence no longer contributes primary capability points. This is an intentional general change; test it on broader role families before deployment.
- Missing recorded evidence is unresolved, not proof of inability. This review validates engine mechanics against stored evidence, not resumes/career claims independently.
- No candidate-specific condition exists. Public people.json and directory code are unchanged. No production data or function was changed.

## Verification

- Focused Node gate runs the existing nine scoring invariants, the existing LinkedIn isolation test, new architecture/import-to-ranking tests, and two existing importer tests.
- TypeScript 5.9.3 `--noEmit` passes for candidate-cache.ts, qualification-evidence.ts, evidence-layers.ts, job-import.ts and types.ts.
- Actual five-candidate replay includes evidence-layer attachment and final sorting; scores/components reproduce the original production snapshot before changes and the table above after changes.
- Full repository suite had seven failures before changes and the same seven after: live-directory cache count assumption, misplaced createDelayedAdminStub, obsolete intent-based scoring assertion, two obsolete semantic score assertions, footer completeness, and fit-tone expectation. These were not silently redefined or repaired in this scoring change.
- Ready with qualifications: focused behavior and type checking pass; not represented as a green repository suite or production deployment.
