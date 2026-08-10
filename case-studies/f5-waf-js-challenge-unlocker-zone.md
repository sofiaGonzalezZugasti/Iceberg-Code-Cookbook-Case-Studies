# DP74492 — BE – La Chambre (FLWB, dossiers législatifs, legislat 56)

**Source URL:** https://www.lachambre.be/kvvcr/showpage.cfm?section=flwb&rightmenu=right&language=fr&cfm=ListDocument.cfm

One HTML page per legislative dossier, keyed by `dossierID` (zero-padded, `0001`..~`1646`)
for `legislat=56`, plus PDFs under `/FLWB/PDF/56/<n>/<name>.pdf`.

---

## Challenge

The site is behind an **F5 BIG-IP ASM WAF with a JavaScript challenge**, and the WAF has
**two responses, both HTTP `200 OK`** (so a naïve crawler stores them as successes and
the parser then dies with `No output from parse script`):

1. **~244-byte HARD block** — `Request Rejected ... Your support ID is: <NNN>`, served when
   the client/IP is in a hot, rate-blocked state.
2. **~48 KB JS CHALLENGE** — no `<title>`, `no-cache` metas, contains the text `support ID`,
   and an obfuscated `<script>` that computes a token, sets a `TS...` cookie, and reloads
   to the real page. Served to any cookieless client.

A plain `fetch`/`fetchWithCookies` can never clear #2 — it doesn't run JavaScript, so it
gets the challenge page forever. (An initial run of ~1685 pages that "worked" was pure
cookie-jar luck: one early request held a valid `TS` cookie that got reused until it
expired.) Belgian, datacenter and rotating-residential IPs all hit the same gate — country
choice was never the fix. Rapid retrying only made it worse: it stacked a temporary hard
block that flagged the **entire** proxy footprint (all countries + static + no-proxy → 244),
which heals only after ~1 h of silence.

---

## Solution

**Route through BrightData's unlocker zone `zone-2captcha-country-<cc>`.** It solves the JS
challenge **server-side**, so a plain `fetchWithCookies` returns the real page — no browser,
light on Iceberg. Verified: `zone-2captcha-country-nl` and `-be` both return the real
dossier (title *La Chambre des représentants de Belgique*, no `support ID`, ~34 KB).

Two approaches were rejected on the way:
- **Plain fetch / proxy-zone hopping** — never clears the JS challenge.
- **Playwright (`playwrightManager`)** — *does* clear the challenge, but a browser-per-page
  504s the crawl container and 502s the shared browserless service. Doesn't scale.

Run settings: **Parallelism 2, Politeness 1**. Judge success by **Monitor → Downloaded**,
not the Test-URL preview.

**Crawl in `dossierID`-range batches — don't run all ~1646 at once.** The full corpus in a
single run is too much (unlocker latency/cost, and it re-agitates the WAF). Instead, target
one slice of IDs per run with a **range regex in the *Do not cache* patterns**, then shift
the range and re-run. Example pattern for `0100`–`0399` (`dossierID=0[1-3][0-9]{2}`):

```
https:\/\/www\.lachambre\.be\/kvvcr\/showpage\.cfm\?section=\/flwb\&language=fr\&cfm=\/site\/wwwcfm\/flwb\/flwbn\.cfm\?lang=F\&legislat=56\&dossierID=0[1-3][0-9]{2}
```

Repeat with `0[4-6][0-9]{2}`, `0[7-9][0-9]{2}`, `1[0-6][0-9]{2}`, … until the whole range is
covered. This is what actually got the crawl through end-to-end.

---

## Key snippets

**`fetchURL` — unlocker zone + block detection (HTML & PDF).** The country pin is required;
bare `zone-2captcha` returns the 244 block. `return []` on a block so junk is never stored
(the URL stays uncached and is retried next run). `simpleResponse` gives the required
`{canonicalURL, request, response}` shape.

```js
async function fetchURL(args) {
  const { canonicalURL } = args;
  const isPdf = /\.pdf(\?|$)/i.test(canonicalURL);
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
  const zones = ['zone-2captcha-country-nl', 'zone-2captcha-country-be']; // unlocker, country pin required
  for (const zone of zones) {
    try {
      const resp = await fetchWithCookies(canonicalURL, { method: 'GET', headers: { 'User-Agent': UA } }, zone);
      const buf = await resp.buffer();
      const head = buf.toString('latin1', 0, 600);
      if (head.includes('support ID') || head.includes('Request Rejected')) { console.log(`blocked ${zone}: ${canonicalURL}`); continue; }
      if (isPdf) {
        if (buf.slice(0, 5).toString('latin1') !== '%PDF-') { console.log(`notpdf ${zone}: ${canonicalURL}`); continue; }
        return [simpleResponse({ canonicalURL, mimeType: 'application/pdf', responseBody: buf })];
      }
      const html = buf.toString('utf8');
      if (html.length < 1000) { console.log(`empty ${zone}: ${canonicalURL}`); continue; }
      return [simpleResponse({ canonicalURL, mimeType: 'text/html', responseBody: html })];
    } catch (e) { console.log(`err ${zone}: ${e && e.message}`); }
  }
  console.log(`all zones failed: ${canonicalURL}`);
  return [];
}
```

**Diagnostic — a `text/plain` zone scan.** HTML renders blank in the Test tab, so probe
zones by returning plain text (this is how the working zone was found):

```js
async function fetchURL({ canonicalURL }) {
  let out = '';
  for (const z of ['zone-2captcha-country-nl', 'zone-2captcha-country-be', 'no-proxy']) {
    try {
      const r = await fetchWithCookies(canonicalURL, { method: 'GET' }, z);
      const b = await r.text();
      out += `[${z}] status=${r.status} len=${b.length} ${b.includes('support ID') ? 'BLOCKED' : 'OK'}\n`;
    } catch (e) { out += `[${z}] ERR ${e.message}\n`; }
  }
  return [simpleResponse({ canonicalURL, mimeType: 'text/plain', responseBody: out })];
}
```

---

## Gotchas

- **F5 ASM returns HTTP 200 for BOTH its hard block (244 B) and its JS challenge (~48 KB).**
  Never trust the status — inspect the body for `support ID` / `Request Rejected`.
- **A non-browser fetch can never pass the JS challenge.** If a fetch-based crawl "works for
  a while then dies," it's cookie-jar luck, not a bypass — go to the unlocker zone.
- **`zone-2captcha` needs a country pin** (`-country-nl`/`-be`); bare `zone-2captcha` = 244.
  The unlocker adds ~5–30 s latency and costs more than residential — keep it scoped to the site.
- **Every backend here fails when hammered and recovers with rest:** the WAF (global hard
  block from rapid retrying, heals ~1 h) and Iceberg's browserless service (502 after
  browser-per-page). Design for least load; don't rapid-retry.
- **Don't crawl the whole corpus in one run** — batch it via a `dossierID`-range regex in
  *Do not cache*, shifting the range each run (see Solution). One big run is too much load.
- Rotating `zone-g1` can return `502 Tunnel creation failed` (BrightData-side, transient).
- **The Test-URL preview renders these JS pages blank even on success** — judge by
  Monitor → Downloaded; use `text/plain` `simpleResponse` output for in-Test diagnostics.
- Return via `simpleResponse(...)`; a bare `{canonicalURL, response}` throws
  `AssertionError: request must be returned by fetchData`.
