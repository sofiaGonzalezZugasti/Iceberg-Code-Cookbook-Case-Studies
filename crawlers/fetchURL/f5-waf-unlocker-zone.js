// WHEN TO USE:
// A site sits behind an F5 BIG-IP ASM WAF that serves a JavaScript challenge (or a tiny
// "Request Rejected / Your support ID is: <NNN>" page) with HTTP 200 — so plain fetch never
// gets the real page and Playwright is too heavy to run per-URL.
//
// HOW IT WORKS:
// Routes the request through BrightData's unlocker zone `zone-2captcha-country-<cc>`, which
// solves the JS challenge server-side and returns the real page to a plain fetchWithCookies.
// It reads the body as a buffer, treats the F5 block/challenge markers as failure and falls
// through to the next country zone, and otherwise stores HTML (or a PDF, verified by %PDF-).
//
// WARNINGS / GOTCHAS:
// - The country pin is REQUIRED: bare `zone-2captcha` returns the 244-byte block; use
//   `-country-nl` / `-country-be` / etc.
// - F5 returns HTTP 200 for BOTH its hard block and its JS challenge — never trust status;
//   inspect the body for "support ID" / "Request Rejected".
// - The unlocker adds ~5-30s latency and costs more than residential — scope it to the site.
// - Return via simpleResponse() for the required {canonicalURL,request,response} shape; a
//   bare {canonicalURL,response} throws "AssertionError: request must be returned by fetchData".
// - Don't crawl a large corpus in one run — batch it (e.g. an ID-range regex in the
//   "Do not cache" patterns, shifted each run); one big run re-agitates the WAF.
//
// USED IN: DP74492 (BE – La Chambre, FLWB dossiers législatifs)

async function fetchURL(args) {
    const { canonicalURL } = args;
    const isPdf = /\.pdf(\?|$)/i.test(canonicalURL);
    const UA =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

    // Unlocker zones — solve the JS challenge server-side. Country pin required.
    const zones = ["zone-2captcha-country-nl", "zone-2captcha-country-be"];

    for (const zone of zones) {
        try {
            const resp = await fetchWithCookies(
                canonicalURL,
                { method: "GET", headers: { "User-Agent": UA } },
                zone
            );
            const buf = await resp.buffer();

            const head = buf.toString("latin1", 0, 600);
            if (head.includes("support ID") || head.includes("Request Rejected")) {
                console.log(`blocked ${zone}: ${canonicalURL}`);
                continue;
            }

            if (isPdf) {
                if (buf.slice(0, 5).toString("latin1") !== "%PDF-") {
                    console.log(`notpdf ${zone}: ${canonicalURL} len=${buf.length}`);
                    continue;
                }
                return [simpleResponse({ canonicalURL, mimeType: "application/pdf", responseBody: buf })];
            }

            const html = buf.toString("utf8");
            if (html.length < 1000) {
                console.log(`empty ${zone}: ${canonicalURL} len=${html.length}`);
                continue;
            }
            return [simpleResponse({ canonicalURL, mimeType: "text/html", responseBody: html })];
        } catch (e) {
            console.log(`err ${zone}: ${e && e.message}`);
        }
    }

    console.log(`all zones failed: ${canonicalURL}`);
    return []; // never store a block page; URL stays uncached and retries next run
}