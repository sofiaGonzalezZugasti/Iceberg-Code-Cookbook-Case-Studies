# Case Study: DP76307 — Consejo de Educación Superior (CES), Gaceta Oficial

## Overview
| Field | Value |
|---|---|
| **Project ID** | `DP76307` |
| **Full name** | Consejo de Educación Superior (CES) — Gaceta Oficial |
| **Country** | Ecuador |
| **Source URL** | https://gaceta.ces.gob.ec/inicio.html |
| **Source type** | JSF/PrimeFaces session-stateful search + paginated listing + session-scoped PDF endpoint |
| **Hooks used** | getSeeds, fetchURL, discoverLinks, parsePage (×2) |
| **Status** | Done — crawler verified end to end; bulk load running |

## What was crawled / parsed

The Gaceta Oficial is the CES document repository: administrative agreements
(*Acuerdos*), regulations (*Reglamentos*) and resolutions (*Resoluciones*) from
2011 onwards. **12,446 documents in 1,246 listing pages**: 1,603 Acuerdos,
65 Reglamentos, 10,778 Resoluciones.

For each document we collect the listing metadata (type, document number, date,
description) plus the official PDF, an HTML rendering for inline viewing and the
extracted plain text.

## Crawler

### Seed URLs

Three seeds, one per document type:

```
https://gaceta.ces.gob.ec/inicio.html?tipoDoc=11&tipoNombre=Reglamentos
https://gaceta.ces.gob.ec/inicio.html?tipoDoc=1&tipoNombre=Acuerdos
https://gaceta.ces.gob.ec/inicio.html?tipoDoc=12&tipoNombre=Resoluciones
```

The first design used `type × year` (48 seeds, 2011–2026). That was wrong: the
date filter is silently ignored by the server, so every year walked the same
full list at a different offset. See Challenge 5.

### Whitelist patterns

```
https://gaceta\.ces\.gob\.ec/inicio\.html\?tipoDoc=.*
https://gaceta\.ces\.gob\.ec/lista\.html\?.*
https://gaceta\.ces\.gob\.ec/documento_oficial\.pdf\?doc=.*
```

`lista.html` does not exist on the server. It is a synthetic label invented by
the crawler so the router can tell listing pages from seeds; it is never
requested over HTTP.

### fetchURL strategy

A **three-level cascade**, one unit of work per call. Each call rebuilds its own
JSF session from scratch, which costs requests but makes every unit retryable
and resumable:

| Level | URL shape | Requests | Produces |
|---|---|---|---|
| Seed | `inicio.html?tipoDoc=N&tipoNombre=X` | 5 | page URLs (`doNotSave`) |
| Page | `lista.html?tipoDoc=N&...&first=N&rows=10` | ~16 | normalised table + document URLs |
| Document | `documento_oficial.pdf?doc=<URI>&id=N&cod=...&fila=N` | ~10 | one PDF |

Measured: 9.3 s per page call, 14.4 s per document call.

The shared session setup is four requests before any search is possible: a GET
for the initial `ViewState`, then three PrimeFaces component events
(`j_idt38` → `j_idt52` → `j_idt66`) that walk the splash screen into the
advanced-search panel.

The document level is where the interesting part lives. There is no per-document
URL; `documento_oficial.pdf` is a servlet that returns whatever the session
currently holds. The sequence that works:

```js
const id = await resolverId(code, fila, vs, headers);   // POST, id from Location header
const detHtml = await decode(await get(`${BASE}?id_documento=${id}`, headers));
const vsDet = vsHtml(detHtml);                          // NEW view, new ViewState
await post(cargaInicialForm(vsDet), headers);           // the on-load remoteCommand
const buf = await (await get(PDF, headers)).buffer();   // plain GET, now returns the file
```

→ `crawlers/fetchURL/jsf-session-scoped-binary-ajax-priming.js`
→ `crawlers/fetchURL/jsf-primefaces-datatable-pagination.js`
→ `crawlers/fetchURL/three-level-cascade-one-unit-per-call.js`

### discoverLinks strategy

Each level emits HTML containing empty `<a href>` anchors for the next level,
and `discoverLinks` queues them. Seed responses carry `doNotSave: true` since
they exist only to produce links — link discovery still works on unsaved
responses (verified in the job log).

```js
function discoverLinks({ content, contentType, canonicalURL, requestURL }) {
  if (!/html/i.test(contentType || '')) return [];
  if (!content) return [];

  const $ = cheerio.load(content);
  const base = requestURL || canonicalURL;
  const out = [];

  $('a[href]').each(function () {
    const href = $(this).attr('href');
    if (!href || href === '#' || /^javascript:/i.test(href)) return;
    const abs = url.resolve(base, href);
    if (/\/lista\.html\?/.test(abs) || /\/documento_oficial\.pdf\?doc=/.test(abs)) {
      out.push(abs.split('#')[0]);
    }
  });

  console.log(`discoverLinks [${canonicalURL}]: ${out.length} enlaces`);
  return out;
}
```

The anchors injected into the page-level response are deliberately **empty and
unidentified**, because the listing parser reads the same HTML: no inner text so
it contributes nothing to any description, and no `id` matching
`^tablaResultados:\d+:` so it is not mistaken for a row's PDF link.

→ `crawlers/discoverLinks/synthetic-anchors-between-cascade-levels.js`

## Parser

Two parsers over the same crawl, merged by URI.

### URL patterns

Listing parser:
```
https://gaceta\.ces\.gob\.ec/lista\.html\?.*
```

PDF parser:
```
https://gaceta\.ces\.gob\.ec/documento_oficial\.pdf\?doc=https.*
```

The `doc=https` anchor is load-bearing: it excludes PDFs downloaded by earlier
crawler revisions, whose `?doc=` carried a positional key. Without it the
platform's `pdf2htmlEx` filter runs over stale non-PDF responses and floods the
log with `xref table` errors before `parsePage` is even called.

### parsePage strategy

**The crawler builds the URI once and writes it in the two places the parsers
read.** `data-doc` on each normalised table row, and `?doc=` on the PDF URL.
Neither parser computes it. This is what guarantees the two sides are
byte-identical, which is the condition for merging.

The listing parser reads a normalised table the crawler emits:

```html
<table id="cesFilas"><tbody>
  <tr data-ri="10" data-id="245825" data-doc="https://gaceta.ces.gob.ec/inicio.html?id_documento=245825">
    <td class="cesTipo">Reglamentos</td>
    <td class="cesCodigo">RPC-SE-19-No.055-2021</td>
    <td class="cesFecha">2021/06/28</td>
    <td class="cesDescripcion">Reglamento de Carrera y Escalafón…</td>
  </tr>
</tbody></table>
```

Normalising in the crawler collapsed the listing parser from ~150 lines to ~50:
the sibling walk, the `indexOf(code)` string slicing, the date/description
splitting regex and the mojibake patch all disappear. The crawler sees the real
HTML, decodes once and hands over separate fields.

→ `parsers/parsePage/normalised-table-from-crawler.js`
→ `parsers/utilities/double-encoded-utf8-repair.js`
→ `parsers/utilities/sanitise-string-for-raw-mapping.js`

### Fields extracted

| Field | Source | Notes |
|---|---|---|
| `URI` | crawler, `data-doc` / `?doc=` | `inicio.html?id_documento=N`. Not resolvable, but unique and stable |
| `title` | listing `td.cesCodigo`, PDF `&cod=` | the document number, per the ticket. Both parsers write the same value |
| `date` | listing `td.cesFecha` | this is *Fecha de elaboración*. The source does not publish an effective date anywhere structured |
| `description` | listing `td.cesDescripcion` | newlines preserved; programme lists are multi-line |
| `documentType` | listing `td.cesTipo` | drives the `Class` mapping lookup |
| `issuer` | constant `CES` | |
| `originalPdf` | `responseBody.id` | reference to the media object the crawler already stored |
| `content` | `pdf2htmlEx` filter | HTML for inline viewing, truncated at page boundaries |
| `fullText` | `pdftotext`, OCR fallback | `tesseractOCRSpanish` for 2011–2014 scans |
| `contentMatchesKey` | computed | audit flag; no Data Model property, log only |

## Challenges & Solutions

### Challenge 1: No per-document URL, and the PDF endpoint is session-scoped

**Problem:** `documento_oficial.pdf` always returned a 55-byte "not found" page.
It is not a file but a servlet that serves whatever document the session
currently holds. Selecting a row and GETting the PDF was not enough.

**Solution:** the detail view delivered by GET is a shell. The work of loading
the document into the session bean is done by a PrimeFaces `remoteCommand`
(`j_idt47`) that the browser fires on page load. Fire that ajax, then a plain
GET returns the real file. The `j_idt173` download POST that the original code
used was not needed — and was actively harmful, because its body carried
`inEstDoc_input=fechaTotal` with empty filters and reset the session's search
state.

A `remoteCommand` fired on load does **not** carry `behavior.event` or
`partial.event`. Copying the shape of a click event gives a silent empty partial
response with no error.

### Challenge 2: A catch-all turned a broken crawl into a successful one

**Problem:** the original `fetchURL` wrapped everything in one `try` and did
`console.error` + `return []` in the `catch`. In Iceberg `return []` means "this
URL has no content, and that's correct". The job finished `FINISHED`, Monitor
showed no errors, and 12,400 PDFs were missing without a single trace.

**Solution:** `return []` is reserved for things genuinely worth skipping
(malformed URLs, levels that don't belong to this handler). Every real failure
throws, with the diagnosis inside the message, so it lands in Monitor and gets
retried.

The same class of problem hid the diagnosis for two days: the executor's
`console` output did not reach the log group being queried. Hence the habit of
stamping a version string as the first line of every hook — if the stamp isn't
in the log, you are not running what you think you are running.

### Challenge 3: The proxy zone was down, not the code

**Problem:** 240 identical failures, `responseCode=-1`, each dying 1.2 s in
after exactly one HTTP request.

**Solution:** a probe matrix over proxy zones showed `zone-g1-*` returning
`Tunnel creation failed. Received status code 502` in *every* variant — with and
without country, with and without session, EC and US — while `no-proxy`,
the default pool and `zone-static_zone` all returned 200 with a valid
`ViewState`. When every variant of a zone fails identically, the variable is the
zone, not the configuration.

`zone-static_zone` was chosen: a static residential IP suits a multi-step
session flow. Incidentally, the session survived three different egress IPs, so
this server does not appear to bind sessions to IP.

### Challenge 4: The per-call time limit was assumed, not measured

**Problem:** the whole architecture was initially designed around a ~30 s cap.
One observed call ran for 51 s before failing for an unrelated reason.

**Solution:** the real limit is the 600 s in the job configuration. Measure
platform limits; don't infer them. The cascade is still worth it — not for the
timeout but for per-document retries, resumability and useful traces.

### Challenge 5: The date filter is silently ignored

**Problem:** 48 `type × year` seeds all reported the same totals. Requesting
`anio=2011` returned `ACU-CPICS-SO-23-No.522-2026` dated 2026/07/15.

**Solution:** the filter does nothing. Drop the year from the seeds: 3 seeds
instead of 48, 1,246 pages instead of ~19,936 — which would have hit the 20,000
page cap and stopped without explanation.

This is also the root cause of the duplicate records: 16 years walking one list
at different offsets produced up to 46 URIs for the same document (a 5,000-record
sample contained only 938 distinct document numbers).

### Challenge 6: Pagination returns bare `<tr>` fragments

**Problem:** `first=0` worked; every `first>0` returned a table with no rows.

**Solution:** two things at once.

`tablaResultados_skipChildren=true` and `tablaResultados_encodeFeature=true` are
**mandatory**. With them the server returns only the requested page's rows. Without
them it re-renders the whole DataTable *and resets the offset to 0* — so every page
silently returns the first one, which is the most expensive kind of bug because it
looks like success.

The price is that the response is a loose run of `<tr>` elements with no
`<table>`. A `<tr>` outside a table is not valid HTML, so the parser **discards
it** and the selector finds zero rows even though the data is in the string.
Wrapping is all it takes:

```js
function comoTabla(frag) {
  if (!frag) return '';
  return /<tbody|<table/i.test(frag) ? frag : '<table><tbody>' + frag + '</tbody></table>';
}
```

### Challenge 7: The result counter lies, and so can the rows

**Problem:** "Se han encontrado N documentos" returned 1,584 and 1,603 for the
same query in different runs. Reglamentos (65 documents) once reported 1,603 —
the Acuerdos figure — because Acuerdos was processed first.

**Solution:** the cookie jar is container-scoped, so every call shares one
server session and the panel returned is sometimes the previous search's. Two
defences:

- Read the total from the DataTable widget's `rowCount`, which is rendered with
  the rows, instead of the header text.
- Validate the **rows** against the requested type (each row carries its own
  `[ Reglamentos ]` label) and retry with a fresh flow on mismatch. The total
  cannot detect the bleed because it is corrupted too — to detect a corrupt
  value you need an independent source.

This is also why `Parallelism` must stay at 1. Raising it means two calls
sharing one `jsessionid` and trampling each other's server state.

### Challenge 8: Double-encoded UTF-8, in one response only

**Problem:** `EducaciÃ³n`, `TÃ©cnica`, `MatrÃ­culas` — but only in the pagination
response. The search response (page 0) was clean.

**Solution:** the UTF-8 bytes of `ó` (`C3 B3`) were read as two Latin-1
characters and re-encoded (`C3 83 C2 B3`). Decoding as UTF-8 is correct and
still yields `Ã³`. Repair at the byte boundary, once, in the crawler, rather
than patching field by field in each parser.

Note: applying the repair to the whole document can fail, because
`Buffer.from(s, 'latin1')` truncates anything above U+00FF and the U+FFFD guard
then rejects the result. Apply it per field, where the strings are short.

### Challenge 9: Identity — what actually identifies a document

**Problem:** three candidate keys, two of them wrong.

`codigo--rowIndex` is a *position*. With the year filter broken it produced up
to 46 URIs per document.

`docNumber + date` was the agreed replacement and would have been worse.
Verified on the site: `ACU-CPICS-SO-04-No.053-2024` dated `2024/01/30` has
**16 rows and 16 distinct PDFs**, one per institute. The document number
identifies the *administrative act*; the row identifies the *document*. Sharing
a URI is an instruction to merge, so those 16 would have collapsed into one and
15 would have vanished with no trace in any log.

Of the two failure modes, the one that inflates is preferable to the one that
loses, because it can be counted.

**Solution:** `id_documento`, read from the `Location` header of the selection
POST. The page level resolves it for each of its 10 rows (+1 request per row,
~10% on total request count) so the listing parser can see it too. URI:
`https://gaceta.ces.gob.ec/inicio.html?id_documento=245825`. Preview result:
3,306 rows, 3,306 distinct URIs, zero duplicates.

Identity is also verified *before* downloading: the id the row resolves to now
must match the one the URI fixed at queue time, otherwise the list has shifted
and this PDF is not this record's.

### Challenge 10: A greedy regex that only woke up later

**Problem:** the PDF parser read its merge key with `URL.match(/[?&]doc=(.+)$/)`.
Fine while `doc` was the last parameter. Once the crawler appended coordinates,
the key became `RPC-SE-03-No.012-2026--10&tipoDoc=11&first=10&rows=10&fila=10`
and **nothing merged**, in 100% of records, with no error anywhere.

**Solution:** `[^&]+`. When extracting a query parameter, bound the character
class to the parameter. `.+` in a query extractor is a bug waiting for its turn.

### Challenge 11: Weak validation stored files that were not PDFs

**Problem:** hundreds of stored "PDFs" that `pdf2htmlEx` could not open:
`May not be a PDF file`, `Couldn't read xref table`, `Illegal character <6e> in
hex string` — ASCII letters where the cross-reference table should be. The same
`mediaObject` hash appeared in every failure, i.e. it was **one** junk file
stored many times.

**Solution:** the old code validated only the five bytes of `%PDF-`. Any
truncated response starting with that signature passed. Validate magic bytes
**and** a minimum size, and throw with the first 60 bytes in the message:

```js
const esPdf = buf && buf.length > 1000 && buf.slice(0, 5).toString('latin1') === '%PDF-';
```

Weak validation does not fail. It contaminates silently.

### Challenge 12: Mapping types and field names

**Problem:** `dataType is required on RAW` and `content must be a string or
binary, not object with keys [...]`, chased through several rounds.

**Solution:** three separate lessons.

- A failing mapping **aborts the whole record**, and the engine stops at the
  first failure. So the absence of errors on the other fields is not evidence
  that they work — they never got their turn.
- `Value` is the name of the key the parser returns, not the name of the field.
  Copying example mappings verbatim from another project maps `undefined`.
- Truncating HTML by character count cuts mid-tag and produces markup the
  mapping cannot classify. Truncate at structure boundaries — `pdf2htmlEx`
  emits one `<div id="pf...">` per page.

Use the `TEST` button under each mapping. It validates one field in seconds and
would have saved several full runs.

## Gotchas

- **Component ids are hardcoded and will break on redeploy.** `j_idt38`,
  `j_idt52`, `j_idt66`, `j_idt104`, `j_idt132`, `j_idt187`, `j_idt47`. JSF
  generates these; any change to the page structure renumbers them. If `setup`
  starts failing, re-capture the payloads from F12 → Network.
- **`Parallelism` must stay at 1.** The cookie jar is container-scoped, so
  concurrent calls share one server session. Real parallelism would require
  managing `JSESSIONID` by hand with plain `fetch` instead of
  `fetchWithCookies`.
- **Re-crawling needs `Do not cache patterns`.** Already-crawled pages carry the
  old `data-doc`. Changing the crawler does not rewrite stored responses, and
  `Skip URLs newer than 90 days` will skip them, so the listing patterns must be
  in `Do not cache patterns` or nothing changes.
- **`rows` travels in the URL, not just in a constant.** If `ROWS` changes from
  10 to 100, any queued URL would point at different documents, silently.
- **The date is *Fecha de elaboración*, not an effective date.** The source
  publishes no effective date in any structured place. It appears occasionally
  inside the description text (`Reglamento de Régimen Académico (Fecha de
  vigencia:16 de septiembre de 2022)`).
- **Some document codes come dirty.** `RESOLUCIÓN PRES-CES-No.030-2018`, and
  some with non-printable characters. Both broke URL-typed mappings. Trim to the
  code pattern and strip anything outside printable ASCII.
- **Descriptions carry a stray leading apostrophe** (`'Ajuste curricular…`).
  Check whether it is in the record or only in the spreadsheet export — Excel
  and Sheets prefix text cells with `'`.
- **Multivalue fields accumulate.** `documentType` ended up as
  `Acuerdos | Acuerdos` from whitespace-differing values. UPSERT adds, it does
  not replace, so existing bad values need manual cleanup even after the crawler
  normalises.
- **A field the parser returns with no mapping is dropped silently.** After
  writing a parser, diff the keys of the `return` against the mapping list one
  by one. `docNumber`, `rowIndex`, `derogado` and `listingURL` were discarded
  this way from the start.
- **Budget:** 36.7 s per page × 1,246 + 14.4 s per document × 12,446 ≈ 60 h at
  `Parallelism` 1. Run it in batches with `SOLO_TIPOS`; Resoluciones alone is
  87% of the work. Two untested levers could cut it: `rows=100` in pagination
  (10× fewer pages) and a working deep link (10 requests → 3 per document).
- **`?id_documento=N` is not a deep link.** A plain GET ignores the parameter
  and returns the empty home page. The URI is a valid, unique, stable URL — it
  just is not resolvable. Worth saying out loud to whoever specs the URI shape,
  because with this source no URI will be.
- **`Expediente completo`** is an untested endpoint on the detail page. If it
  returns a bundle it could collapse tens of thousands of requests into
  hundreds.

## Git instructions

**File path**

```
case-studies/jsf-primefaces-stateful-session-ajax-primed-pdfs.md
```

**Branch**

```
case-study/jsf-primefaces-stateful-session-ajax-primed-pdfs
```

**Commit message**

```
add: case-study jsf-primefaces-stateful-session-ajax-primed-pdfs
```
