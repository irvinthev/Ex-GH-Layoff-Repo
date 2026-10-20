# Recruiter shortlists

## Create a link

1. On the directory, select **Add to shortlist** on candidate cards. Selections survive filtering and are retained in the current browser tab when session storage is available.
2. Choose **Create shortlist**, or open `shortlist-builder.html` directly to search and select profiles.
3. Add a company/title, introduction, and optional role title, public job URL, and match note for each person. The maximum is 20 people.
4. Choose **Create shareable link**, preview it, and copy it to the recruiter.
5. The recruiter can select people and copy an interest list to send back. No messages are automatically sent or candidate interest inferred.

The generic link stores the selected profile references and sender-written content in its URL fragment. There is no server-side save, account system, or confidential-note storage. Everyone who receives a link can read and forward its contents. Editing notes requires creating and distributing a new link. Old generic links cannot be revoked; profile removals still apply. Do not include private contact details, résumé excerpts, or confidential notes.

## Named links

`shortlist.html?list=engine` loads `shortlists/engine.json`. This is a readable URL for an intentionally maintained shortlist. Changing its JSON updates notes behind the same URL; removing the JSON withdraws the saved list. Named shortlists are repository files and should be reviewed through pull requests. The public builder does not publish or overwrite named lists.

Entries contain `id`, `role`, `url`, and `note`. The list contains `v: 1`, `title`, `intro`, and `items`. Use `TalentShortlist.personId(person)` from `shortlist-core.js` for each current public directory record. Never use array indexes or copy a private résumé into a saved list. Only publish entries for profiles already in `people.json`.

## Profile freshness and removals

Recruiter views fetch the current `people.json` with `cache: no-store`; names, bios, locations, and LinkedIn links come from that file. A removed or ambiguous profile is withheld and counted as unavailable. Profile references use normalized LinkedIn paths; records without LinkedIn use normalized names, withholding duplicate names. A changed LinkedIn path requires updating that shortlist reference. The global data refresh continues to own `people.json`.

A shared link's role match is a sender assessment, not a verified qualification or candidate endorsement. Employment status and job availability must be checked before introductions. The saved Engine list uses public profile evidence only and deliberately excludes candidates not yet in the public directory.

## Validation

Run `node --experimental-strip-types --test tests/*.test.mjs` and syntax-check the modified JavaScript. Core tests cover Unicode sharing links, safe URLs, schema limits, duplicate references, directory reorder/name changes, live profile updates, removals, corrupt/blocked storage, and the saved Engine list.

UI checks should cover directory selection across filters, builder editing/removal, preview and copy, reload of a shared link, clipboard denial/manual copy, malformed links, blocked storage, no current profiles, and narrow-screen layouts. No browser or physical-device rendering verification is claimed by the unit tests.
