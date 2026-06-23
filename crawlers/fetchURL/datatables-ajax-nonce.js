// WHEN TO USE:
// A listing is powered by a WordPress DataTables plugin (WDT) that requires
// a nonce token fetched from the page HTML before the AJAX endpoint accepts
// requests. Paginate by incrementing the start offset.
//
// TIP: getSharedVariable/setSharedVariable cache the nonce across requests
// in the same job — avoids fetching the listing page on every paginated call.
//
// USED IN: DP74366 variant (US – Court of Appeals, Federal Circuit)

const LISTING_URL = "https://www.example.com/opinions/";
const AJAX_URL    = "https://www.example.com/wp-admin/admin-ajax.php?action=get_wdtable&table_id=1";
const NONCE_KEY   = "wdt-nonce";
const PAGE_LENGTH = 200;
const MAX_START   = 8000;
const CUTOFF_YEAR = 2024;
const ZONE        = "no-proxy";

async function getNonce(headers) {
  let nonce = getSharedVariable(NONCE_KEY);
  if (nonce) return nonce;
  const resp = await fetchWithCookies(LISTING_URL, { method: "GET", headers }, ZONE);
  nonce = cheerio.load(await resp.text())("#wdtNonceFrontendServerSide_1").attr("value") || "";
  setSharedVariable(NONCE_KEY, nonce);
  return nonce;
}

async function fetchURL({ canonicalURL, headers }) {
  if (!/\/opinions\/?$/.test(canonicalURL)) {
    const resp = await fetchWithCookies(canonicalURL, { method: "GET", headers }, ZONE);
    return [{ canonicalURL, response: resp }];
  }

  const nonce = await getNonce(headers);
  const postHeaders = Object.assign({
    "X-Requested-With": "XMLHttpRequest",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
  }, headers);
  const results = [];

  for (let start = 0; start <= MAX_START; start += PAGE_LENGTH) {
    const body = `draw=1&start=${start}&length=${PAGE_LENGTH}&wdtNonce=${encodeURIComponent(nonce)}`;
    const resp = await fetchWithCookies(AJAX_URL, { method: "POST", headers: postHeaders, body }, ZONE);
    const jsonBody = await resp.text();

    let rows = [];
    try { rows = JSON.parse(jsonBody).data || []; } catch (e) {}
    if (!rows.length) break;

    results.push({
      canonicalURL: LISTING_URL + "?wdtpage=" + start,
      response: { ok: resp.ok, status: resp.status, headers: resp.headers, body: jsonBody },
    });

    const lastYear = parseInt(String(rows[rows.length - 1][0]).split("/")[2], 10);
    if (lastYear < CUTOFF_YEAR) break;
  }

  return results;
}
