// WHEN TO USE:
// The listing is an ASP.NET WebForms page that manages pagination via hidden
// __VIEWSTATE / __EVENTVALIDATION fields and fires __EVENTTARGET postbacks.
// You must read form state from each response before posting the next page.
//
// WARNING: Always wrap in try/catch and return [] on error.
// Always re-read form state from each response — __VIEWSTATE changes every time.
//
// USED IN: DP74366 (US – Court of Appeals, 5th Circuit)

const FORM_URL = "https://www.example.com/listing";
const GRID_ID  = "ctl00$Body$radGrid";
const P        = "ctl00$Body$C010$ctl00$ctl00$";

const MANAGED = [P + "searchMode", P + "startDate", P + "btnSearch"];

function readFields($) {
  const form = {};
  $("input, select, textarea").each((_, el) => {
    const n = $(el).attr("name");
    if (!n || MANAGED.includes(n) || n === "__EVENTTARGET" || n === "__EVENTARGUMENT") return;
    form[n] = $(el).val() || "";
  });
  return form;
}

function buildBody(form, extra) {
  const f = new FormData();
  Object.entries(form).forEach(([k, v]) => f.append(k, v));
  f.append(P + "searchMode", "search");
  f.append(P + "startDate", "2026-01-01-00-00-00");
  f.append(P + "startDate$dateInput", "01/01/2026");
  Object.entries(extra).forEach(([k, v]) => f.append(k, v));
  return f;
}

async function fetchURL({ canonicalURL, headers }) {
  try {
    if (/\.pdf$/i.test(canonicalURL)) {
      const resp = await fetchWithCookies(canonicalURL, { method: "GET", headers }, "no-proxy");
      return [{ canonicalURL, response: resp }];
    }
    if (!/\/listing/.test(canonicalURL)) return [];

    const results = [];

    // GET page 1 to seed form state
    const firstResp = await fetchWithCookies(FORM_URL, { method: "GET", headers }, "no-proxy");
    let form = readFields(cheerio.load(await firstResp.text()));

    // POST: trigger search (page 1)
    let html = await (await fetchWithCookies(FORM_URL, {
      method: "POST",
      body: buildBody(form, { "__EVENTTARGET": "", "__EVENTARGUMENT": "", [P + "btnSearch"]: "Search" })
    }, "no-proxy")).text();

    form = readFields(cheerio.load(html));
    const totalPages = parseInt((html.match(/(\d+)\s+pages?/i) || [, 1])[1]);

    results.push(simpleResponse({ canonicalURL: FORM_URL + "?page=1", mimeType: "text/html", responseBody: html }));

    // POST: subsequent pages via grid postback
    for (let i = 2; i <= totalPages; i++) {
      html = await (await fetchWithCookies(FORM_URL, {
        method: "POST",
        body: buildBody(form, { "__EVENTTARGET": GRID_ID, "__EVENTARGUMENT": "Page$" + i })
      }, "no-proxy")).text();
      form = readFields(cheerio.load(html));
      results.push(simpleResponse({ canonicalURL: FORM_URL + "?page=" + i, mimeType: "text/html", responseBody: html }));
    }

    return results;
  } catch (err) {
    console.error("WebForms pagination error:", err && err.message);
    return [];
  }
}
