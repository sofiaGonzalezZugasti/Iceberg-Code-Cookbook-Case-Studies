// WHEN TO USE:
// The site has a hierarchical structure: main page → year index pages → PDFs.
// The first parser generates URI-only records for intermediate pages;
// a second parser then handles the PDFs.
//
// USED IN: US Executive Orders (multiple states)

function parsePage({ responseBody, URL }) {
  if (!responseBody?.content) return [];
  let $;
  try { $ = cheerio.load(responseBody.content); } catch (e) { return []; }

  if (/\/\d{4}\/index\.htms?$/i.test(URL)) return extractPDFLinks($, URL);
  return extractYearLinks($, URL);
}

function extractYearLinks($, baseURL) {
  const results = [];
  $("a[href]").each(function () {
    const href = $(this).attr("href");
    if (!href || !/\d{4}\/index\.htms?$/i.test(href)) return;
    results.push({ URI: url.resolve(baseURL, href) });
  });
  return results;
}

function extractPDFLinks($, baseURL) {
  const results = [];
  $("td a[href]").each(function () {
    const href = $(this).attr("href");
    if (!href || !href.toLowerCase().endsWith(".pdf")) return;
    const orderNumber = $(this).text().replace(/\s+/g, " ").trim() || null;
    results.push({
      URI: url.resolve(baseURL, href),
      ...(orderNumber && { order_number: orderNumber }),
    });
  });
  return results;
}
