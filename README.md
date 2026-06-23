# Iceberg Code Cookbook & Case Studies

A collection of reusable JavaScript snippets, utility functions, and real-world case studies for building crawlers and parsers on the Iceberg content ingestion platform.

> **Internal use only** — vLex Content Developer team.

---

## What is this?

When you solve a non-trivial crawling or parsing problem, add it here so the team doesn't solve it twice.

This repo is organized by **technical hook**, with source-type variants within each section:

```
crawlers/
  getSeeds/        # How to generate seed URLs dynamically
  fetchURL/        # How to fetch pages (proxies, auth, JS rendering, binaries)
  discoverLinks/   # How to extract and filter links from pages

parsers/
  utilities/       # Reusable helper functions (dates, HTML cleanup, PDF extraction...)
  parsePage/       # How to extract structured records from crawled pages

case-studies/      # Real projects with challenges, solutions, and gotchas
```

---

## How to use a snippet

Each file contains a single self-contained pattern with:
- A comment explaining **when to use it**
- The code itself
- Any important warnings or notes

Copy the snippet into your Iceberg job, adjust the selectors/URLs/field names to your source, and go.

---

## Crawlers

### `getSeeds`

| File | Use case |
|---|---|
| `static-list.js` | Hardcoded list of seed URLs |
| `year-loop.js` | Generate one seed URL per year |
| `year-type-matrix.js` | Generate seeds for every year × document type combination |
| `offset-pagination.js` | Generate paginated seeds using `?start=N` or `?offset=N` |

### `fetchURL`

| File | Use case |
|---|---|
| `user-agent-rotation.js` | Rotate random browser User-Agent strings per request |
| `binary-download.js` | Download PDFs/DOCX with content-length validation |
| `url-type-router.js` | Route different URL types to different fetch logic |
| `post-json-api.js` | POST to a JSON search API with custom security headers |
| `aspnet-webforms-pagination.js` | Handle ASP.NET WebForms stateful pagination (`__VIEWSTATE`) |
| `datatables-ajax-nonce.js` | Paginate a WordPress DataTables (WDT) AJAX endpoint with nonce |

### `discoverLinks`

| File | Use case |
|---|---|
| `simple-all-links.js` | Extract all `<a href>` links from an HTML page |
| `html-json-dispatcher.js` | Handle both HTML and JSON responses in the same function |
| `strict-pdf-filter.js` | Extract only PDF links matching a specific URL pattern |
| `section-boundary.js` | Collect links only within named sections of a page |
| `json-data-rows.js` | Extract document URLs from a JSON data table response |

---

## Parsers

### `utilities`

| File | Use case |
|---|---|
| `run-remote-filter.js` | Fetch filter output (pdftotext, OCR, pdf2htmlEX) via GraphQL |
| `content-objects.js` | Build `htmlContent`, `textContent`, and `pdfRef` objects |
| `uri-builder.js` | Build deduplicated URI arrays (encoded + decoded variants) |
| `date-parsing.js` | Parse dates with multi-format fallback using moment.js |
| `html-cleanup.js` | Sanitize HTML and extract plain text |
| `pdf2htmlex.js` | Extract readable HTML from pdf2htmlEX output |
| `text-cleaning.js` | Clean author strings, remove trailing dots, normalize whitespace |
| `pdf-already-downloaded.js` | Check via GraphQL whether a PDF has already been crawled |

### `parsePage`

| File | Use case |
|---|---|
| `pdf-simple-store.js` | Store original PDF + HTML from filter, no field extraction |
| `pdf-text-pipeline.js` | Extract text: pdftotext → pdf2htmlEX → OCR fallback |
| `pdf-ocr-cleanup.js` | Fix systematic OCR errors in old scanned documents (1970s–1990s) |
| `pdf-multiple-opinions.js` | Split a single PDF into multiple records by opinion marker |
| `pdf-debug-mode.js` | Run all filters and store debug output for inspection |
| `html-detail-page.js` | Parse a single-record HTML detail page |
| `html-pdf-router.js` | Route PDF and HTML URLs to different parse logic in one parser |
| `html-date-grouped-table.js` | Parse a listing page with date-grouped tables (multiple records) |
| `html-two-stage-uri.js` | Two-stage parsing: main page → year index → PDFs |
| `html-scoped-container.js` | Parse a CMS container with h2 + ul structure (DNN, WordPress) |
| `html-table-pdf-links.js` | Extract order numbers and titles from a table with PDF links |
| `html-regex-paragraphs.js` | Parse records encoded inline in `<p>` text using regex |

---

## Case Studies

Real projects with notes on challenges, solutions, and gotchas. Add a case study whenever you solve something non-trivial.

| File | Project |
|---|---|
| `_template.md` | Template — copy this when adding a new case study |
| `DP71206-nc-ethics-opinions.md` | US – North Carolina Ethics Opinions |
| `DP74366-us-court-of-appeals-ca5.md` | US – Court of Appeals, 5th Circuit |

---

## Contributing

1. Create a branch: `git checkout -b snippet/your-pattern-name`
2. Add your file to the relevant folder
3. Follow the existing format: comment block explaining when to use it, then the code
4. Open a PR — another team member reviews before merging to `main`

### Commit conventions

```
add: aspnet-webforms-pagination fetchURL pattern
fix: pdf-text-pipeline OCR fallback order
update: case-study DP71206 NC ethics opinions
```

### Adding a case study

Copy `case-studies/_template.md`, fill in the fields, and open a PR.

---

## Available filters for `runRemoteFilter`

| Filter | Description |
|---|---|
| `pdftotext_raw` | Fast text extraction for digitally-born PDFs |
| `pdf2htmlEx` | Converts PDF to HTML preserving layout |
| `pdftohtmlExFallback` | Alternative pdf2htmlEX invocation |
| `tesseractOCR` | OCR with auto-detected language |
| `tesseractOCREnglish` | OCR forced to English |
| `tesseractOCRSpanish` | OCR forced to Spanish |

---

## Proxy zones reference

| Scenario | Zone |
|---|---|
| Most sites | `zone-g1-country-<cc>` |
| Multi-step login (same IP) | `zone-g1-country-es-session-<id>` |
| Site has CAPTCHAs | `zone-2captcha-country-<cc>` |
| Site blocks proxies | `no-proxy` |
| Playwright (browser) | `playwrightManager.setProxyZone("g1")` |
