# Case Study: DP76774 — US – Louisiana Court of Appeal, Fifth Circuit – Opinions

## Overview

| Field | Value |
|---|---|
| **Project ID** | `DP76774` |
| **Full name** | US – Louisiana Court of Appeal, Fifth Circuit – Opinions |
| **Country** | US |
| **Source URL** | https://www.fifthcircuit.org/searchopinions.aspx |
| **Source type** | ASP.NET WebForms search form behind Google reCAPTCHA v2 + PDFs |
| **Hooks used** | getSeeds, fetchURL, parsePage |
| **Status** | Done |
| **Owner** | Facundo Herrera |

---

## What was crawled / parsed

Every opinion and disposition from 1992 to today, searched month by month with the
"By Decision Month/Year" option of the search form. The results page lists one row per
case, with one or more disposition links to PDFs. A full run covered 417 months and about
7,000 PDFs, and only 1 token was rejected in the whole crawl.

Two parsers: a listing parser (one record per PDF, metadata from the results table) and a
PDF parser (content + a fallback decision date read from the PDF text). Both merge by URI.

---

## Crawler

### Seed URLs
One synthetic seed per month. The URL is never fetched as-is: `fetchURL` reads year and
month from it and runs the form flow.
```
https://www.fifthcircuit.org/searchopinions.aspx?year=<yyyy>&month=<m>
```
→ `crawlers/getSeeds/year-loop.js` (adapted to year × month)

For the recurring scheduler, the seed generator is limited to the **last 3 months**. Seeds
are re-crawled on every run regardless of cache, and each seed costs one captcha solve, so a
scheduler with the full history would pay for ~400 tokens every week.

### Whitelist patterns
Only the PDFs linked from the results page:
```
https://www\.fifthcircuit\.org/dmzdocs/.*\.pdf
```

### fetchURL strategy
Three requests per month over **one fixed proxy session** (same IP and cookie jar), so the
ASP.NET form state stays valid:

1. `GET searchopinions.aspx` → read every input (`__VIEWSTATE`, `__EVENTVALIDATION`, …).
2. Postback `__EVENTTARGET=…ddlSearchOptions` with value `2` → the month and year dropdowns
   appear, and the response has a new ViewState.
3. `POST` with month, year, `btnSearch=Search` and `g-recaptcha-response=<token>`.

The token comes from the **2captcha API**, requested at the start in parallel with steps 1–2.
It does not depend on the ViewState. Details and code:
→ `crawlers/fetchURL/recaptcha-v2-2captcha-api.js`
→ `crawlers/fetchURL/aspnet-webforms-pagination.js` (ViewState handling)

```js
// Fixed session per month and attempt: a new attempt gets a new IP, ViewState and token.
const zone = `zone-g1-country-us-session-${year}${month.padStart(2, '0')}a${attempt}`;
```

Result handling:
- The page is accepted only if it shows the site's record counter **or** its
  "no records" notice. Anything else counts as a rejected token and is retried once, from
  scratch.
- A month with 0 records returns `[]` and nothing is stored.
- PDFs (not seeds) go through `defaultFetchURL` with `zone-g1-country-us`. The default zone
  returned a tunnel 502 on about 1 in 5 PDFs.

### discoverLinks strategy
Default discovery. The results page has plain `<a href>` links to the PDFs.

---

## Parser

### URL patterns
- Listing: `https://www\.fifthcircuit\.org/searchopinions\.aspx\?.*`
- PDF: `https://www\.fifthcircuit\.org/dmzdocs/.*` (filter: PDF to Text)

### parsePage strategy
**Listing:** one record per disposition that has a PDF, with the URI set to the PDF URL
(encoded and decoded aliases). The case fields repeat on each of the case's records.
Records are deduplicated by URI within the page. If a row has no date, the key is left out
so the PDF parser can fill it.

**PDF:** stores the original PDF, the transcoded HTML and the plain extracted text (only
if the text passes a characters-per-page guard). It also reads a fallback decision date from
the first pages, trying in order: a line that is only a date, the court stamp
(`APR 2 6 1994`) and the closing formula ("this 28th day of April, 2026"). A date is only
accepted if its year matches the PDF's folder year.

### Fields extracted

| Field | Source | Notes |
|---|---|---|
| `URI` | PDF link | aliases `%20` / space; mapping On duplicate `+=` |
| `caseNumber` | row `lblCaseNum` | e.g. `23-KH-431` |
| `caseType` | case number code | CA / C / K / KH → label; unknown codes kept as-is |
| `title`, `parties` | row `lblCaseTitle` | parties split on VERSUS / VS. / C/W / CONSOLIDATED WITH, on separate lines or inline |
| `decisionDate` | disposition text `'…' on MM/DD/YYYY` | PDF parser fills it with `||=` when the listing has none (1995–2000 rows) |
| `documentType` | PDF folder | OI/PO → Published Opinion, WI → Writ Disposition / Misc Writ Filing, RE → Rehearing Disposition |
| `disposition` | disposition text | |
| `originalPdf`, `htmlContent`, `extractedText` | PDF | PDF parser |

---

## Challenges & Solutions

### Challenge 1: reCAPTCHA v2 that the site really validates
**Problem:** Six stealth browser setups (Playwright, Nodriver, Zendriver, Patchright,
Camoufox, invisible_playwright) all ended on the image challenge. Traffic to Google through
BrightData is also blocked.
**Solution:** the 2captcha API called from `customRequestExecutorCode`. 2captcha solves the
captcha with its own IPs, and the crawler only sends the token in the form POST. No browser
is involved.

### Challenge 2: "2captcha doesn't support reCAPTCHA"
**Problem:** the answer at first was that 2captcha only handles image captchas.
**Solution:** there are two different things with the same name:

| | `zone-2captcha` / `resolveCaptcha(imageBuffer)` | 2captcha API from code |
|---|---|---|
| Solves | image captchas, WAF JS challenges | reCAPTCHA v2 / v3 and others |
| Google traffic | would go through BrightData (not allowed) | done by 2captcha |
| Key | none in the code | `getSecretsManagerValue('<2captcha-secret-id>')` (ask the platform team for the id and field) |

The second one is already used by many production CrawlJobs.

### Challenge 3: API key showing up in the logs
**Problem:** the legacy API (`in.php?key=…`, `res.php?key=…`) sends the key in the URL, and
Iceberg logs every request URL, so the key ended up in plain text in CloudWatch.
**Solution:** switch to the v2 API (`createTask` / `getTaskResult`) with `clientKey` in the
JSON body. Validated with 0 occurrences of the key in the logs of a real run.

### Challenge 4: empty months looked like rejected tokens
**Problem:** a few months (e.g. 1992-08, 2005-09) have no decisions. Without a counter, they
were retried and failed as if the token had been rejected.
**Solution:** also accept the site's "There were no records returned based on your
criteria." notice as a valid results page, and return `[]`.

---

## Gotchas

- **Test with a Crawl Job, not Test URL.** Solving takes 15–120 s and Test URL cuts at 504.
- **The token lasts ~2 min and is single use.** Request it in parallel with the page loads,
  discard it after ~100 s, and get a new one per submit.
- **Only the submit button you want should travel in the POST.** Strip every
  `input[type=submit]` from the scraped fields, then add `btnSearch` alone. ASP.NET fires
  whichever button name it receives.
- **Never trust the HTTP status.** A rejected token returns 200 with the form again. Check a
  marker that only exists on the results page.
- **No proxy parameter for 2captcha** (`RecaptchaV2TaskProxyless`). BrightData credentials
  only exist inside `fetchWithCookies`; never hardcode them. If a site binds the token to
  the IP, escalate to the platform team.
- **Every token costs money.** Get explicit approval for the ticket before the historical
  crawl, and keep the scheduler seeds short.
- **Rehearings appear in two months** (the opinion's and the rehearing's), so the same PDF
  record is parsed from two listing pages. Check a few of them after scheduled runs.
- **Before using it on another site:** identify the captcha type (`g-recaptcha` +
  `data-sitekey`, `h-captcha`, `cf-turnstile`, …). Only reCAPTCHA v2 is proven here. Check
  the site's Terms of Use for an explicit bot ban before starting.

---

## Requirements doc
DevOps ticket DP-76774.
