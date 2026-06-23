// WHEN TO USE:
// A listing page presents documents in an HTML table where each row contains
// an order number (with a PDF link) and a title in adjacent cells.
// Scopes to a specific container to avoid nav/header rows.
//
// USED IN: US Executive Orders (multiple states)

function parsePage({ responseBody, URL }) {
  if (!/html/i.test(responseBody.fileFormat)) return [];
  const $ = cheerio.load(responseBody.content);
  const results = [];

  const container = $("#content .container").first();
  if (!container.length) { console.error("Container not found for", URL); return []; }

  container.find("table tr").each(function () {
    const firstCell  = $(this).find("td").first();
    const secondCell = $(this).find("td").eq(1);
    const anchor     = firstCell.find("a[href]").first();
    const pdfHref    = anchor.attr("href");

    if (!pdfHref || !/\.pdf$/i.test(pdfHref)) return;

    const orderNumber = anchor.clone()
      .find(".hidden, .doc-icon-suffix, img").remove().end()
      .text().replace(/\s+/g, " ").trim() || null;
    if (!orderNumber) return;

    const year  = (/^(\d{4})/.exec(orderNumber) || [])[1] || null;
    const title = secondCell.clone().find("a").remove().end()
      .text().replace(/\s+/g, " ").trim() || null;

    results.push({ URI: [url.resolve(URL, pdfHref)], order_number: orderNumber, year, title });
  });

  return results;
}
