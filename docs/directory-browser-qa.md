# Directory browser QA

## Mobile compact-controls follow-up

The follow-up removes the function-chip row below 641px, uses two side-by-side native filter pickers, places active filters below them, and groups result count, Clear all, and Share results on one compact row. Native pickers preserve device/browser selection behavior without adding custom dialogs.

All 55 real Chromium browser assertions and all 95 Node regression tests pass. At 320px and 390px, tests confirm hidden redundant chips, side-by-side pickers, working Engineering/Chicago filtering, a results toolbar no taller than 52px, a filtered control panel shorter than 330px, keyboard navigation skipping hidden chips, keyboard filter removal, and clearing back to all profiles. Desktop chips remain visible at 768px, 1024px, and 1440px. Screenshots of the filtered mobile state at 320px and 390px and the desktop state at 1440px were visually inspected. No horizontal page overflow was observed at any of the five widths.

The earlier Chromium-only qualification still applies: no physical iPhone or Safari test has been performed. This follow-up does not modify candidate data, publication gates, forms, or the card content.

Run date: October 15, 2026 (America/New_York).

## Result

Ready with qualifications: 36 browser assertions and all 95 existing Node regression tests pass. JavaScript syntax and diff whitespace checks pass. No page JavaScript errors were observed during the browser scenarios.

Actual Chromium 153 headless rendering was exercised through Playwright, against the local checkout and existing public people.json. The previous Playwright browser download was unavailable; a packaged Chromium binary was installed through npm and extracted without changing repository dependencies.

## Responsive and visual review

| Viewport | Candidate columns | Horizontal page overflow | Search visible on arrival |
| --- | --- | --- | --- |
| 1440 x 1050 | 3 | None | Yes |
| 1024 x 768 | 2 | None | Yes |
| 768 x 1024 | 2 | None | Yes |
| 390 x 844 | 1 | None | Yes |
| 320 x 740 | 1 | None | Yes |

Arrival and candidate-card screenshots were visually inspected at all five sizes. Footer screenshots were inspected at 1440px and 390px. Function chips intentionally scroll inside their own row. No clipped card content or overlapping controls was observed in the inspected views. Narrow-screen navigation wraps to a second row.

## Functional coverage

- Profiles load; function chips filter results; clearing restores all candidates.
- Candidate links restore the intended name search; filtered links restore function selection.
- Copy search link writes the filtered URL to the clipboard.
- Clipboard denial exposes a selected, read-only manual-copy field.
- Navigating away and using browser Back restores the filter URL and result count.
- Tab reaches search help and function chips; Enter and Space activate chips.
- Focus remains on the selected chip after rendering; Space removes filter breadcrumbs.
- Location selection works through keyboard arrows and Enter.
- Search focus styling remains visible at each viewport size.
- Markup in search text is escaped; empty-state clearing restores results.

## Fixes made during QA

- Placed search before the function-chip row; chips scroll horizontally rather than displacing search with multiple rows.
- Aligned cards and controls in one constrained content container, with mobile side margins.
- Replaced simulated breadcrumb controls with native buttons for standard keyboard behavior.
- Exposed search help on keyboard focus and connected its accessible description.
- Replaced a missing-font location glyph with a text label.

## Reproduce

Run from the repository root with Playwright available locally or through CODEX_PRIMARY_RUNTIME_NODE_MODULES:

```sh
DIRECTORY_QA_BROWSER=/absolute/path/to/chromium node scripts/qa-directory.cjs
node --experimental-strip-types --test tests/*.test.mjs
```

Omit DIRECTORY_QA_BROWSER when Playwright has its default Chromium installed. The browser script starts its own local static server on port 8765 and writes temporary screenshots under /tmp. It does not submit forms or change candidate data.

## Scope limits

This is Chromium viewport testing, not physical-device or Safari/Firefox validation, screen-reader certification, or an accessibility conformance audit. Existing public profile content was rendered, not fact-checked. Candidate links remain name-based and can collide for duplicate names. The changes remain in a draft PR and have not been deployed.
