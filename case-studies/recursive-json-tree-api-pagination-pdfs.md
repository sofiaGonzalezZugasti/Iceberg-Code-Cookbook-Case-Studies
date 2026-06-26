# Case Study: DP74127 — US – Courts Opinions (govinfo.gov)

## Overview

| Field | Value |
|---|---|
| **Project ID** | `DP74127` |
| **Full name** | US – Courts Opinions (govinfo.gov) |
| **Country** | US |
| **Source URL** | https://www.govinfo.gov/app/collection/uscourts |
| **Source type** | Recursive JSON tree API + PDFs |
| **Hooks used** | fetchURL, discoverLinks, parsePage |
| **Status** | Done |

---

## What was crawled / parsed

Opinions published by US federal courts and hosted on govinfo.gov. The source exposes
a recursive JSON navigation tree (`/wssearch/rb/uscourts`) organised by court type →
court name → year → document listing. Each leaf node contains document metadata and a
PDF link. Two parsers run in tandem: one extracts structured metadata from the JSON
listing, the other stores the PDF with transcoded and plain-text content.

---

## Crawler

### Seed URLs
```
https://www.govinfo.gov/wssearch/rb/uscourts?fetchChildrenOnly=1
```

### Whitelist patterns
```
https:\/\/www\.govinfo\.gov\/wssearch\/rb\/uscourts
https:\/\/www\.govinfo\.gov\/content\/pkg\/.+\.pdf
```

### Crawler settings

| Setting | Value | Notes |
|---|---|---|
| Max depth | 50 | Tree is deep: type → court → year → page → PDF |
| Max pages | 500,000 | Very large source |
| Parallelism | 1 | Required — site rejects concurrent requests |
| Politeness factor | **0.1** | See performance gotcha below |
| Custom request timeout | 120s | JSON responses can be slow |
| Do not cache patterns | `https:\/\/www\.govinfo\.gov\/wssearch\/rb\/uscourts` | Navigation JSON must always be re-fetched |
| Cache skip (days) | 90 | PDFs are stable; skip if < 90 days old |

### fetchURL strategy
Minimal override: injects `Accept` and `Referer` headers before delegating to
`defaultFetchURL`. The `Referer` header mimics browser navigation from the collection
page, which some govinfo endpoints check.

```js
args.headers = Object.assign({}, args.headers, {
  'Accept': 'application/json, application/pdf, */*',
  'Referer': 'https://www.govinfo.gov/app/collection/uscourts'
});
return defaultFetchURL(args);
```

### discoverLinks strategy
The JSON tree has three distinct node types, each handled differently:

**1. Navigation nodes (court types / court names)**
Children have a `browsePath` — enqueue each child as a `?fetchChildrenOnly=1` URL.

**2. Year nodes (`generic3valnav`)**
Only the most recent year is enqueued to avoid crawling historical data on every run.
The year with the highest numeric `displayValue` wins.

**3. Document listing pages (`hasDocumentResults === true`)**
- Page 0 fans out all remaining pages using `offset` + `pageSize=100`
- Each child node with a `pdffile` field gets a PDF URL queued

```js
// Only page 0 fans out pagination
if (pageNumber === 0 && total > PAGE_SIZE) {
  const lastPage = Math.min(Math.ceil(total / PAGE_SIZE) - 1, MAX_PAGE);
  for (let p = 1; p <= lastPage; p++) {
    links.push(`${path}?fetchChildrenOnly=1&offset=${p}&pageSize=${PAGE_SIZE}`);
  }
}
// One PDF per document
for (const c of children) {
  if (c.nodeValue && c.nodeValue.pdffile) links.push(PDF_BASE + c.nodeValue.pdffile);
}
```

---

## Parser

### URL patterns
```
https:\/\/www\.govinfo\.gov\/wssearch\/rb\/uscourts.*   → metadata parser
https:\/\/www\.govinfo\.gov\/content\/pkg\/.+\.pdf      → PDF parser
```

### parsePage strategy — two parsers, one merge key

**Parser A (JSON listing):** reads each child node from the JSON response and extracts
structured metadata. Uses the PDF URL as the merge key (`URI`) to fuse with the PDF parser.

```js
results.push({
  URI: [pdfUrl],        // merge key
  docketNumber,         // extracted from browseline1 or packageid
  title,
  date,                 // normalised to YYYY-MM-DD
  courtIssuer,          // parsed from browsePath segments
});
```

**Parser B (PDFs):** stores the original PDF, transcoded HTML, and plain text.
Uses `runRemoteFilter` to retrieve `pdf2htmlEx` (HTML) and `pdftotext_raw` (plain text)
outputs already computed by Iceberg's filter pipeline.

```js
const out = { URI: buildURI(URL) };
if (responseBody.id)           out.printContent = pdfRef(responseBody);
if (htmlContent?.trim())       out.printTranscodedContent = extractHtmlContent(htmlContent);
if (plainText?.trim())         out.extractedText = textContent(plainText);
```

### Fields extracted

| Field | Source | Notes |
|---|---|---|
| `docketNumber` | `browseline1` regex or `packageid` | Falls back to packageid if browseline1 parse fails |
| `title` | `document.title` | Whitespace-normalised |
| `date` | `document.publishdate` | Normalised via `parseDate()` with multiple format fallbacks |
| `courtIssuer` | `browsePath` segment 1 | Strips leading numeric prefix |
| `printContent` | `responseBody.id` | Original PDF as media object |
| `printTranscodedContent` | `pdf2htmlEx` filter output | HTML rendition for display |
| `extractedText` | `pdftotext_raw` filter output | Plain text for search indexing |

---

## Challenges & Solutions

### Challenge 1: Recursive JSON tree with heterogeneous node types
**Problem:** The API returns different node shapes depending on depth — court type,
court name, year, and document listing nodes all have different fields and require
different handling. A single generic handler would either miss nodes or enqueue
irrelevant branches.
**Solution:** Detect node type at runtime: check for `hasDocumentResults`,
`generic3valnav` (year nodes), and `browsePath` (navigation nodes) and route each
to its own logic branch.

### Challenge 2: Very large number of URLs — crawl took over a day at default settings
**Problem:** The source contains hundreds of thousands of PDFs across all federal courts
and years. With parallelism=1 and politeness factor=1, the crawler was processing ~1 URL
every 1–2 seconds, making a full run take more than a day.
**Solution:** Reduce the politeness factor from `1` to `0.1`. The politeness factor is
a multiplier on wait time relative to crawl time — a value of 1 means "wait as long as
the last fetch took" (up to ~1s), while 0.1 reduces that to ~100ms. This alone cut
crawl time dramatically without triggering rate limiting on govinfo.gov.
Alternatively, increasing parallelism achieves the same effect but carries more risk
of being blocked on sources that are sensitive to concurrent requests.

### Challenge 3: Navigation JSON must not be cached
**Problem:** Navigation nodes (court listings, year nodes) change as new documents are
published. If cached, the crawler would miss new courts or years on subsequent runs.
**Solution:** Add `https:\/\/www\.govinfo\.gov\/wssearch\/rb\/uscourts` to the
**Do Not Cache** patterns. PDF URLs are stable and benefit from the 90-day cache.

### Challenge 4: Docket number extraction is inconsistent
**Problem:** The docket number is embedded in `browseline1` HTML as free text (e.g.
`"24-10386 - Some Title"`), but the format is not always consistent across court types.
**Solution:** Try a regex on `browseline1` first; fall back to parsing the `packageid`
field (e.g. `USCOURTS-ca5-24-10386`) which is more reliable but less human-readable.

### Challenge 5: Date format varies by court
**Problem:** `publishdate` comes in multiple formats across different court types
(`DD/MM/YYYY`, `YYYY-MM-DD`, `MMMM D, YYYY`, ISO 8601, etc.).
**Solution:** `parseDate()` tries a list of known formats in order using moment.js,
returning `null` if none match rather than producing a wrong date.

---

## Gotchas

- **Politeness factor is the single biggest lever for crawl speed** on this source.
  Default value of 1 makes a full crawl take 24h+. Set to 0.1 for govinfo.gov.
- Only the **most recent year** is enqueued per court — intentional. If historical data
  is needed, remove the `generic3valnav` filter and enqueue all year children.
- `MAX_PAGE` is capped at 99 (10,000 docs per court branch). If a branch has more,
  the remainder will be silently skipped. Monitor `root.count` vs pages enqueued.
- `browsePath` uses `/` separators with spaces inside segment names — each segment
  must be `encodeURIComponent`-encoded individually, not the whole path at once.
- The `fetchChildrenOnly=1` parameter is required on all navigation URLs. Without it,
  the API returns the full rendered page instead of JSON.
- PDF cache is set to 90 days. The navigation JSON (`/wssearch/rb/uscourts`) is
  explicitly excluded from caching — never cache it or new documents will be missed.
