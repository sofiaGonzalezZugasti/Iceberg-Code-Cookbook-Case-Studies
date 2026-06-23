# Case Study: DP74366 — US – Court of Appeals, 5th Circuit

## Overview

| Field | Value |
|---|---|
| **Project ID** | `DP74366` |
| **Full name** | US – Court of Appeals, Federal Circuit – Opinions & Orders |
| **Country** | US |
| **Source URL** | https://www.ca5.uscourts.gov/electronic-case-filing/case-information/current-opinions |
| **Source type** | ASP.NET WebForms paginated listing + PDFs |
| **Hooks used** | fetchURL, discoverLinks |
| **Status** | Done |

---

## What was crawled / parsed

Opinions and orders published by the US Court of Appeals for the 5th Circuit.
The listing is an ASP.NET WebForms page that requires stateful POST pagination
via `__VIEWSTATE` / `__EVENTVALIDATION` fields. Documents are PDFs.

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
The listing requires:
1. A GET request to load the initial form state (`__VIEWSTATE`, `__EVENTVALIDATION`)
2. A POST with `btnSearch` to trigger the search and get page 1
3. Subsequent POSTs using `__EVENTTARGET = radGridOpinions` and `__EVENTARGUMENT = Page$N`

Form state must be re-read from each response before posting the next page
because `__VIEWSTATE` changes on every response.

→ `crawlers/fetchURL/aspnet-webforms-pagination.js`

### discoverLinks strategy
Only PDF links matching the `/opinions/(pub|unpub)/` path are queued.
All other links (navigation, pagination anchors, external) are ignored.

→ `crawlers/discoverLinks/strict-pdf-filter.js`

---

## Parser

### URL patterns
```
https://www\.ca5\.uscourts\.gov/opinions/(pub|unpub)/\d{2}/.*\.pdf
```

### parsePage strategy
PDFs only — store original PDF with html filter output.
→ `parsers/parsePage/pdf-simple-store.js`

---

## Challenges & Solutions

### Challenge 1: ASP.NET WebForms stateful pagination
**Problem:** Standard GET requests to the listing URL only returned page 1.
Pagination is handled via JavaScript postbacks that submit hidden form fields
(`__VIEWSTATE`, `__EVENTVALIDATION`, `__EVENTTARGET`, `__EVENTARGUMENT`).
**Solution:** Read all form fields from the GET response, trigger search via POST,
then paginate by re-posting with `__EVENTTARGET = radGridOpinions` and
`__EVENTARGUMENT = Page$N` for each subsequent page.

### Challenge 2: Reading total page count
**Problem:** The page count is rendered as plain text: "57 items in 3 pages".
**Solution:** Extract with regex: `html.match(/(\d+)\s+pages?/i)`.
If not found, default to a conservative maximum and let empty pages terminate
the loop naturally.

### Challenge 3: MANAGED fields causing double-submission
**Problem:** Form fields managed manually (startDate, searchMode, btnSearch)
were also being captured by `readFields()` and submitted twice.
**Solution:** Maintain a `MANAGED` array of field names to skip in `readFields()`.

---

## Gotchas

- The `P` prefix (`ctl00$Body$C010$ctl00$ctl00$`) is specific to this site's
  WebForms control tree. It will be different on other ASP.NET sites — inspect
  the form HTML to find the correct prefix.
- `__VIEWSTATE` can be very large (50KB+). Do not log it — it will flood CloudWatch.
- The date filter (`startDate`) is set to `01/01/2026` in this implementation.
  Adjust `START_INPUT` and `START_INTERNAL` when deploying for a different date range.
- The site works without a proxy (`no-proxy`) — do not add a proxy zone or
  requests will be rejected.
