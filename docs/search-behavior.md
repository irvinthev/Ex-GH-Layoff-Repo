# Directory search and location behavior

Search now requires every supplied keyword to match somewhere in the existing
searchable profile fields. Terms can appear in different fields and in any order.
Quoted phrases must appear together. Senior/Sr and Junior/Jr are normalized for
matching without changing displayed job titles. No fuzzy matching, inferred skills,
or new profile fields are introduced.

Changing a function through the dropdown, chip, function dashboard, or breadcrumb
does not clear location. If the selected function has no candidates in that location,
the location remains selected with a count of zero and the directory shows its empty
state. Shared links preserve that selection. Clear all still resets every filter.

The nine approved Function corrections were compared with the current published
Employee List CSV and included in people.json. Candidate count/order and all other
profile fields remain unchanged. The CSV contained the corrections during this run;
the live site's cached JSON still showed the earlier categories. Deployment of this
change has not been verified. Specialty and Target Roles remain absent from the feed.

Verification: 103 Node tests and 75 Chromium browser assertions pass. JSON schema
validation, JavaScript syntax, and diff checks pass. Browser scenarios cover Katie's
finance-systems search, Chirag's QA/release search, software plus Chicago across
fields, marketing filtering, quoted phrases, location persistence, zero-result shared
links, and keyboard/clipboard/back-navigation regressions. Katie, software-QA, and
marketing scenarios pass at 320px and 390px; responsive checks also cover 768px,
1024px, and 1440px. Katie's result screenshots at both phone widths were visually
reviewed. These are Chromium viewport checks, not physical iPhone/Safari testing.
