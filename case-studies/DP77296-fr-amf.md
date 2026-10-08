# Case Study: DP77296 — FR Autorité des Marchés Financiers (AMF)

## Overview

| Field | Value |
|---|---|
| **Project ID** | `DP77296` |
| **Full name** | France – Autorité des Marchés Financiers (AMF): Règles professionnelles approuvées + Décisions de la Commission des sanctions |
| **Country** | FR |
| **Source URL** | https://www.amf-france.org/fr |
| **Source type** | HTML listing + HTML detail + PDF |
| **Hooks used** | discoverLinks / parsePage |
| **Status** | Done (developer side) — pending Content Validator / vLex section creation |
| **Owner** | Facundo Herrera |

---

## What was crawled / parsed

Two independent AMF sections sharing the same PDF download pattern:

- **Règles professionnelles approuvées**: 278 detail pages, each linking to one PDF via a
  "Télécharger le contenu" button.
- **Décisions de la Commission des sanctions**: 454 detail pages, each linking to one PDF via a
  "Télécharger la décision" button (same underlying template family as Règles).

Both sections merge their detail metadata with a single shared PDF parser (502 PDFs processed:
21 created + 481 updated via URI merge).

---

## Crawler

### Seed URLs
```
https://www.amf-france.org/fr/getlisting/format/421/all/all/all/all/60480
https://www.amf-france.org/fr/rest/listing_sanction/91,184,183,325,90,461,89,242,86,462,181/all/all
```
Both are JSON listing endpoints that return every item in the section in one shot (no pagination
needed).

### Whitelist patterns
```
https://www\.amf-france\.org/fr/reglementation/regles-professionnelles-approuvees/.+
https://www\.amf-france\.org/fr/sanctions-transactions/decisions-de-la-commission-des-sanctions/.+
https://www\.amf-france\.org/sites/institutionnel/files/private/.*\.pdf
https://www\.amf-france\.org/sites/institutionnel/files/[0-9]{4}-[0-9]{2}/.*\.pdf
https://www\.amf-france\.org/sites/institutionnel/files/contenu_simple/regles_professionnelles_approuvees/.*\.pdf
```
The three PDF patterns were all needed — Règles PDFs live under 3 different path shapes
depending on when they were published. Missing the `contenu_simple/...` one caused ~174/278
PDFs to silently not be fetched on the first pass.

**Watch out:** the crawler whitelist is a separate config from the parser's URL Pattern. PDFs
matching the parser pattern but not the crawler whitelist never get fetched in the first place —
if `discoveredLinks` is high but `matchingLinks` stays flat, suspect this before debugging the
parser (see `learnings/dp-77021-learnings.md` P1).

### discoverLinks strategy
Custom function handling both JSON (seed listings) and HTML (detail pages) in the same crawler —
similar to `crawlers/discoverLinks/html-json-dispatcher.js` but reading `item.infos.link.url`
from the AMF-specific JSON shape instead of a generic field name.

```js
function discoverLinks({ content, contentType, canonicalURL, requestURL }) {
  const base = requestURL || canonicalURL;
  if (/application\/json/i.test(contentType) || /^\s*\{/.test(content)) {
    let json;
    try { json = JSON.parse(content); } catch (e) { return []; }
    return (json.data || [])
      .map(item => item.infos && item.infos.link && item.infos.link.url)
      .filter(Boolean)
      .map(href => url.resolve(base, href));
  }
  const $ = cheerio.load(content);
  return $('a[href]').map((i, el) => $(el).attr('href')).get()
    .filter(Boolean).map(href => url.resolve(base, href));
}
```

Note the documented `{$, url}` signature for `discoverLinks` is broken on this platform version
(see `docs/crawlerDoc.md`) — use the `{content, contentType, canonicalURL, requestURL}` signature
shown above.

---

## Parser

### URL patterns
Two detail parsers (one per section, same template family) plus one shared PDF parser matching
all three PDF path shapes from the whitelist.

### parsePage strategy
Case 1 (single-record detail page), but with the `URI` **re-keyed to the PDF link** instead of
the page's own URL — this merges with the shared PDF parser's own record (which uses the PDF URL
as its URI) via Case 14's URI-matching rule, without needing a relationship or lookup.

### Fields extracted

| Field | Source | Notes |
|---|---|---|
| `URI` | pdfHref (re-keyed, not own URL) | see fallback chain below |
| `title` | `h1.like-h1` → fallback `h1` plain | |
| `type` / `theme` | `ul.list-tags li a` (eq 0 / eq 1) | |
| `number` (sanctions only) | regex on title `/^([A-Z]+-\d{4}-\d+)/` → fallback regex on URL slug `/\/(san-\d{4}-\d+)/i` | one 2009 decision had no SAN- prefix in the title |
| `date` | `div.date` via moment.js multi-format | |

---

## Challenges & Solutions

### Challenge 1: 3 sanctions records missing from Preview despite the crawler fetching them fine
**Problem:** Preview gave 451/454. Confirmed via CloudWatch crawl logs that all 3 URLs were
fetched successfully (200, real content, 20-60kB) — so the gap was in the parser, not the
crawler. Two different root causes on inspection:
- 2 pages: normal template, but the "Télécharger" link had no `btn` class (it was a header nav
  link with `class="event-click-atinternet"` instead).
- 1 page: a completely different template for an annulled/appealed decision — no `h1.like-h1`,
  no `div.date`, no `list-tags`.

**Solution:** added a third, fully generic `pdfHref` fallback that doesn't depend on any CSS
class at all — any `<a>` whose text matches `/t[ée]l[ée]charger/i` and whose `href` ends in
`.pdf`:
```js
if (!pdfHref) {
  pdfHref = $('a').filter(function () {
    return /t[ée]l[ée]charger/i.test($(this).text()) &&
           /\.pdf$/i.test($(this).attr('href') || '');
  }).first().attr('href');
}
```
Plus a `title` fallback to plain `<h1>` when `h1.like-h1` is empty. Result: 454/454.

### Challenge 2: 21 "orphan" records created by the shared PDF parser instead of merging
**Problem:** after the real run, the PDF parser created 21 new records (no title/type/theme)
instead of updating an existing detail record via URI merge. Looked like a bug at first.

**Solution:** checked the `Referer` column in Iceberg's Crawled URLs page for each orphan PDF
URL instead of guessing. Two real causes, both legitimate:
- Multi-respondent sanctions (e.g. a decision against a company **and** several individuals)
  expose one "Télécharger" link per respondent on the same detail page. The detail parser's
  `pdfHref` selector only takes `.first()`, so only one of the N PDFs gets merged with metadata;
  the rest get crawled (they match the PDF whitelist) but stay as content-only orphans.
  → the correct long-term fix would be for the detail parser to return one record per PDF link
  found on the page, not just the first.
- Court of Appeal / Cassation rulings linked from the "Recours" (appeal) section of some
  decisions — these are a different document from the AMF's own decision and were never meant
  to have AMF-decision metadata.

**Not fixed in this ticket** (would require redesigning the detail parser to emit multiple
records per page — out of the original scope). Documented as a note for the Content Validator
instead: these 21 records are real content, not noise, they just have no `class`/`database` by
design.

### Challenge 3: `Type: Media` default on rich-content mappings (4th confirmed occurrence)
**Problem:** mapping `htmlContent` (an object `{content, fileFormat, locale, dataType}` built by
the parser code) to the `printTranscodedContent` property defaulted to `Type: Media` in the
Mappings & Execution UI, which throws `TypeError: val.content.includes is not a function` on a
real run (invisible in Preview).

**Solution:** set `Type: Raw` instead. This is documented 3 times already elsewhere
(`dp-76181-learnings.md` P15, `DP-76776/ticket.md`, `dp-77021-learnings.md` P5) — worth promoting
to a hard checklist item in `docs/parser-pattern-reference.md` instead of a repeated learning.

---

## Gotchas

- On this source, `discoveredLinks` in the crawler logs includes nav/footer links, not just
  listing rows — don't use it as the "expected record count," confirm against the live site's
  JSON endpoint length instead.
- The "On duplicate" dropdown in Mappings & Execution defaults to `MERGE_VALUES` (`+=`) for every
  new field. Only `URI` should keep `+=`; every scalar/rich-content field needs `REPLACE_VALUES`
  (`=`) or you'll silently accumulate duplicate values on re-runs.
- Double-clicking "Run" on a slow-to-respond UI can launch two identical parser jobs. Harmless
  here because Execution mode is UPSERT by URI (idempotent), but worth terminating the duplicate
  AWS Batch job to avoid wasting compute — the "Terminate" button's effect can take a minute to
  show up in the Jobs table status, don't assume it failed just because the status didn't change
  immediately.
- The `issuer` relationship (emissor) can't be mapped until the target vLex entity exists —
  check whether the ticket's ontology entity already exists in vLex *before* trying to map any
  `relationship`-type field to it.

---


