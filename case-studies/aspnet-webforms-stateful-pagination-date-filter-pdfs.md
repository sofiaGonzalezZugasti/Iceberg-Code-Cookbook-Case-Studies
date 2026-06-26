# Case Study: DP74366 — US – Court of Appeals, 5th Circuit – Opinions & Orders

## Overview

| Field | Value |
|---|---|
| **Project ID** | `DP74366` |
| **Full name** | US – Court of Appeals, 5th Circuit – Opinions & Orders |
| **Country** | US |
| **Source URL** | https://www.ca5.uscourts.gov/electronic-case-filing/case-information/current-opinions |
| **Source type** | ASP.NET WebForms paginated listing + PDFs |
| **Hooks used** | fetchURL, discoverLinks, parsePage |
| **Status** | Done |

---

## What was crawled / parsed

Opinions and orders published by the US Court of Appeals for the 5th Circuit, filtered
from 2026 onwards. The listing is an ASP.NET WebForms page with stateful POST pagination
via `__VIEWSTATE` / `__EVENTVALIDATION`. Clicking a docket number opens a detail page
with links to PDFs. Two parsers run in parallel: one extracts listing metadata (docket,
date, title, type) from the HTML table, the other stores the PDF with transcoded content.

---

## Crawler

### Seed URLs
```
https://www.ca5.uscourts.gov/electronic-case-filing/case-information/current-opinions
```

### Whitelist patterns
```
https://www\.ca5\.uscourts\.gov/electronic-case-filing/case-information/current-opinions.*
https://www\.ca5\.uscourts\.gov/opinions/(pub|unpub)/\d{2}/\d{2}-\d+.*\.pdf
```

### fetchURL strategy
The listing requires a 3-step stateful flow:

1. **GET** the listing page to capture the initial form state (`__VIEWSTATE`, `__EVENTVALIDATION`)
2. **POST** with `btnSearch` + date filter fields to trigger the search and get page 1
3. **POST** each subsequent page using `__EVENTTARGET = radGridOpinions` and `__EVENTARGUMENT = Page$N`

The date filter (`applyFilter`) must be re-injected on **every** POST, including pagination
requests — not just the initial search. If omitted, the server resets the filter and returns
wrong results.

`__VIEWSTATE` must be re-read from each response before posting the next page, as it changes
on every round-trip.

→ `crawlers/fetchURL/aspnet-webforms-pagination.js`

### discoverLinks strategy
Filters rows by date before queuing: only PDF links from rows with a date ≥ 2026 are
queued. All navigation anchors, external links, and pre-2026 rows are ignored.

```js
// Only queue PDF links from rows dated 2026+
$("tr").each(function(){
  const a = $(this).find("a[href*='/opinions/']").first();
  const href = a.attr("href");
  if (!href) return;
  let year = null;
  $(this).find("td").each(function(){
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec($(this).text().trim());
    if (m){ year = parseInt(m[3],10); return false; }
  });
  if (year === null || year < 2026) return;
  const abs = url.resolve(base, href);
  if (/\/opinions\/[^/]+\/[0-9]+\//i.test(abs)) out.push(abs);
});
```

→ `crawlers/discoverLinks/strict-pdf-filter.js`

---

## Parser

### URL patterns
```
https://www\.ca5\.uscourts\.gov/opinions/(pub|unpub)/\d{2}/.*\.pdf
https://www\.ca5\.uscourts\.gov/electronic-case-filing/case-information/current-opinions.*
```

### parsePage strategy — two parsers, one merge key

**Parser A (listing HTML):** reads the paginated HTML table and extracts one record per row.
Uses the PDF URL as the merge key (`URI`) so the record fuses with the PDF parser output.

```js
results.push({
  URI: [pdfURL],           // merge key: fuses with PDF parser
  docket,                  // e.g. "24-10386"
  date: d.format("YYYY-MM-DD"),  // "01/14/2026" → "2026-01-14"
  title,
  type,                    // "Published Opinion", "Unpublished", etc.
});
```

**Parser B (PDFs):** stores the PDF and transcoded HTML. Extracts `dateFiled` from the
PDF text as a secondary date check. Rejects PDFs where the parsed year is outside 2026–2050.

```js
return [{
  URI: [URL, decodeURI(URL)],
  dateFiled,
  printContent: [{ mediaObjectId: responseBody.id, locale: "en", dataType: "MEDIA" }],
  printTranscodedContent: { content: html, fileFormat: "text/html", locale: "en", dataType: "MEDIA" },
}];
```

### Fields extracted

| Field | Source | Notes |
|---|---|---|
| `docket` | `<a>` text in listing row | e.g. `"24-10386"` |
| `date` | Date cell in listing row | Converted from `MM/DD/YYYY` to `YYYY-MM-DD` |
| `title` | Cell after date cell | e.g. `"State of Texas v. Blanche"` |
| `type` | Cell after title | e.g. `"Published Opinion"` |
| `dateFiled` | PDF text via regex | Parsed from `Date Filed: MM/DD/YYYY` or `FILED Month DD, YYYY` |
| `printContent` | `responseBody.id` | Original PDF stored as media object |
| `printTranscodedContent` | `html` | Transcoded HTML from PDF |

---

## Challenges & Solutions

### Challenge 1: ASP.NET WebForms stateful pagination
**Problem:** Standard GET requests to the listing URL only return page 1. Pagination
is handled via JavaScript postbacks that submit hidden form fields (`__VIEWSTATE`,
`__EVENTVALIDATION`, `__EVENTTARGET`, `__EVENTARGUMENT`).
**Solution:** Read all form fields from the GET response, trigger search via POST with
`btnSearch`, then paginate by re-posting with `__EVENTTARGET = radGridOpinions` and
`__EVENTARGUMENT = Page$N` for each subsequent page. `__VIEWSTATE` must be re-read
from each response before sending the next request.

### Challenge 2: Date filter resets on pagination
**Problem:** The date filter applied on the initial search POST was being lost on
subsequent pagination POSTs, causing the server to return all years instead of 2026+.
**Solution:** `applyFilter(form)` is called inside `post()` itself, so it runs
automatically on every POST — including pagination — not just the initial search trigger.

### Challenge 3: Block-level pagination (Next Pages)
**Problem:** The pager only shows a limited block of page numbers at a time (e.g. 1–10).
To reach page 11, you must first click "Next Pages", which is a separate `__doPostBack`
target, before page 11 becomes available.
**Solution:** When `targetForPage($, n)` returns null, fall back to `targetNextBlock($)`
to advance the pager block, then retry `targetForPage($, n)`.

### Challenge 4: Detecting stalled pagination
**Problem:** On some runs, repeated POSTs return the same page without error, causing
an infinite loop.
**Solution:** Track `prevDockets` (a fingerprint of docket numbers on the current page).
If the next page returns identical dockets, or returns no dockets at all, stop immediately.
A `safety` counter caps the loop at 25 iterations as a final safeguard.

### Challenge 5: Reading total page count
**Problem:** The page count is rendered as plain text: `"188 items in 10 pages"`.
**Solution:** Extract with regex: `html.match(/(\d+)\s+items?\s+in\s+(\d+)\s+pages?/i)`.
If not found, default to `HARD_CAP` (30) and let empty pages terminate the loop naturally.

### Challenge 6: Date extraction from PDFs
**Problem:** PDFs use two different date formats — `Date Filed: MM/DD/YYYY` and
`FILED Month DD, YYYY` — and the text may contain OCR noise around the keyword.
**Solution:** Try the structured format first; fall back to scanning a 120-char window
around the word `FILED` using a month-name regex.

---

## Gotchas

- The control prefix (`ctl00$Body$C010$ctl00$ctl00$`) is specific to this site's WebForms
  control tree. It will be different on other ASP.NET sites — inspect the form HTML to find
  the correct prefix.
- `__VIEWSTATE` can be very large (50KB+). Do not log it — it will flood CloudWatch.
- `applyFilter` must be called on **every** POST, not just the first one. Omitting it on
  pagination requests silently resets the date filter.
- The site works without a proxy (`no-proxy`) — adding a proxy zone causes requests to
  be rejected.
- `HARD_CAP` is set to 30 pages. Adjust if the source grows significantly.
- `START_DATE` is hardcoded to `1/1/2026`. Update `START_DATE` / `END_DATE` constants
  when deploying for a different date range.
- The `P` prefix in form field names (`ctl00$Body$...`) will differ on other ASP.NET sites.
  Always inspect the live form HTML rather than copying prefixes from other projects.
