# Case Study: DP71206 — US – North Carolina Ethics Opinions (Attorney)

## Overview

| Field | Value |
|---|---|
| **Project ID** | `DP71206` |
| **Full name** | US – North Carolina Ethics Opinions (Attorney) |
| **Country** | US |
| **Source URL** | https://www.ncbar.gov/for-lawyers/ethics-and-rules/ethics-opinions/ |
| **Source type** | JSON API (search) + HTML detail pages + PDFs |
| **Hooks used** | fetchURL, discoverLinks, parsePage |
| **Status** | Done |

---

## What was crawled / parsed

Ethics opinions published by the North Carolina State Bar. The listing is powered
by a private JSON search API (POST endpoint). Each opinion has an HTML detail page
and a downloadable PDF.

---

## Crawler

### Seed URLs
```
https://www.ncbar.gov/for-lawyers/ethics-and-rules/ethics-opinions/?status=adopted&page=1
```
The `?status=adopted&page=1` suffix triggers the JSON API routing in `fetchURL`.

### Whitelist patterns
```
https://www\.ncbar\.gov/for-lawyers/ethics-and-rules/ethics-opinions/.*
https://www\.ncbar\.gov/ethics/.*\.pdf
```

### fetchURL strategy
The listing endpoint is a POST JSON API that requires custom security headers
(Azure Application Insights `traceparent`, `sec-ch-ua` headers).
PDFs are served as `application/octet-stream` and require content-type inference
from the `Content-Disposition` header.

→ `crawlers/fetchURL/url-type-router.js`
→ `crawlers/fetchURL/post-json-api.js`
→ `crawlers/fetchURL/binary-download.js`
→ `crawlers/fetchURL/user-agent-rotation.js`

### discoverLinks strategy
The same function handles both HTML listing pages and JSON API responses.
On page 1 of the JSON response, pagination URLs are generated from `totalCount`.

→ `crawlers/discoverLinks/html-json-dispatcher.js`

---

## Parser

### URL patterns
```
https://www\.ncbar\.gov/for-lawyers/ethics-and-rules/ethics-opinions/.*
https://www\.ncbar\.gov/ethics/.*\.pdf
```

### parsePage strategy
Routes by `responseBody.fileFormat` — HTML detail pages extract opinion number,
subject, and body text; PDFs store the original file with html filter output.

→ `parsers/parsePage/html-pdf-router.js`

### Fields extracted

| Field | Source | Notes |
|---|---|---|
| `opinionNumber` | `h1` text via regex | e.g. `"FO-2024-01"` |
| `subject` | `h3.h2` | Topic/subject of the opinion |
| `text` | `div.content__container p` | Body paragraphs joined with `\n\n` |
| `originalPdf` | `responseBody.id` | Only for PDF URLs |

---

## Challenges & Solutions

### Challenge 1: POST JSON API with security headers
**Problem:** The listing endpoint rejected requests without specific browser-like
headers including `sec-ch-ua`, `sec-fetch-*`, and an Azure `traceparent` header.
**Solution:** Captured the headers from a browser network request and hardcoded
them in the `search()` helper. The `traceparent` value does not need to be dynamic.

### Challenge 2: PDFs served as octet-stream
**Problem:** PDF downloads returned `content-type: application/octet-stream`,
causing Iceberg to not recognise them as PDFs.
**Solution:** Infer the real content type from the `Content-Disposition` filename
extension and override the header before returning the response.
→ `crawlers/fetchURL/binary-download.js`

### Challenge 3: Incomplete downloads
**Problem:** Some large PDFs failed mid-download, resulting in corrupt files
stored without error.
**Solution:** Added content-length validation — compare `Content-Length` header
against actual buffer size and return a 504 error if they don't match.

---

## Gotchas

- The `IndexGuid` in the search API body is hardcoded and may change if the site
  is rebuilt. If results suddenly drop to 0, check this value first.
- User-Agent rotation is required — the site returns 403 without a realistic UA.
- The `traceparent` header format is `00-{traceId}-{spanId}-01`. Any valid-looking
  hex string works — it doesn't need to be a real trace ID.
