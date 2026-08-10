# Platform Bug: puppeteerManager/playwrightManager crash kills the whole crawl job

## Overview

| Field | Value |
|---|---|
| **Component** | `puppeteerManager` / `playwrightManager` (backend browser-connection service) |
| **Severity** | `Critical` |
| **Status** | `Open` |
| **Ticket** | N/A |
| **Affected DP(s)** | `DP42706` (same pattern previously seen in `DP73529`) |
| **Reported by** | @facundoherrera-content-bcn |
| **Fixed in** | N/A |

---

## Symptoms

An uncaught exception inside `PuppeteerManager.getPuppeterSocketURL` kills the entire
crawl job every time the crawler reaches a document that requires JS rendering (e.g. a
PDF embedded inside a `<script>` tag, only generated client-side).

```
at PuppeteerManager.newPage (.../PuppeteerManager.js:33:36)
at Function.connect (.../PuppeteerManager.js:213:158)
at Function.getPuppeterSocketURL (.../PuppeteerManager.js:232:32)
TypeError: Only absolute URLs are supported
    at getNodeRequestOptions (node_modules/node-fetch/lib/index.js:1327:9)
```

---

## Conditions to Reproduce

1. Crawler needs JS rendering for a document (e.g. content only generated client-side).
2. Call `playwrightManager.newPage()` (documented API) or `puppeteerManager.newPage()`
   (undocumented) from `fetchURL`.
3. Crash is not deterministic across crawlers with identical code — one crawler can
   finish an entire run clean while two others with the exact same fetch logic crash
   consistently.

---

## Root Cause

Under investigation, but strongly suspected: in this Iceberg installation,
`playwrightManager` and `puppeteerManager` both resolve internally to the same backend
browser-connection service (`PuppeteerManager.js`) — renaming the call from one to the
other does not change which backend service handles the connection. The actual error
(`TypeError: Only absolute URLs are supported` inside `getPuppeterSocketURL`) points to
node-fetch rejecting an empty or relative URL while trying to obtain the browser
connection socket — likely a backend configuration issue (e.g. an empty/malformed
browser-pool endpoint), not something fixable from crawler-side code.

---

## Workaround

Wrap the Playwright/Puppeteer fetch call in `try/catch` (with `finally { page.close() }`
if a `page` object exists) so a crash on one document doesn't take down the whole crawl
job. This does **not** fix the underlying issue — it only contains the blast radius to
the one failing URL.

```js
async function puppeteerFetch(url, { playwrightManager }) {
  let page
  try {
    page = await playwrightManager.newPage({ incognito: true })
    await page.goto(url, { waitUntil: "networkidle" })
    // ... evaluate last <script>, regex over pdfjsProcessing, decode base64 ...
  } catch (err) {
    return null
  } finally {
    if (page) await page.close()
  }
}
```

---

## Fix

N/A — no confirmed fix from the platform team as of this writing.

---

## Notes

- If a crawler stack trace mentions files under `/var/iceberg-app/api/schema-modules/...`
  (not your code, not the documented libraries), treat it as platform infrastructure,
  not a crawler bug — stop iterating on your own code and escalate directly.
- `try/finally` around `page.close()` will not help with this specific crash: it
  happens inside `newPage()`, before a `page` object exists to close.
- Same underlying crash previously observed in `DP73529` with `puppeteerManager`
  (undocumented API) — this is not a one-off.
