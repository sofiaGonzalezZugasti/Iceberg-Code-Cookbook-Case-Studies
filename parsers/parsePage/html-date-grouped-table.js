// WHEN TO USE:
// A listing page groups records by date using div.view-grouping wrappers
// containing a date header and a data table.
// Produces one record per table row, skipping placeholder rows.
//
// USED IN: DP71469 (US – Nebraska Supreme Court)

function parsePage({ responseBody, URL }) {
  const $ = cheerio.load(responseBody.content);
  const results = [];

  $("div.view-grouping").each(function () {
    const group    = $(this);
    const dateTime = group.find("div.view-grouping-header time").attr("datetime");

    let parsedDate = null;
    if (dateTime) {
      const d = moment(dateTime, "YYYY-MM-DDTHH:mm:ssZ");
      parsedDate = d.isValid() ? d.format("YYYY-MM-DD") : dateTime.split("T")[0];
    }

    group.find("table.tablesaw tbody tr").each(function () {
      const cells = $(this).find("td");
      if (!cells.length) return;
      if (/PLEASE NOTE|Christmas holiday/i.test($(this).text())) return;

      const caseNumber = cells.eq(0).find(".tablesaw-cell-content").text().replace(/\s+/g, " ").trim()
        || cells.eq(0).text().replace(/^Case\s+Number\s+/, "").replace(/\s+/g, " ").trim() || null;

      const citeAs = cells.eq(1).find(".tablesaw-cell-content").text().replace(/\s+/g, " ").trim()
        || cells.eq(1).text().replace(/^Cite\s+As\s+/, "").replace(/\s+/g, " ").trim() || null;

      const link  = cells.eq(2).find("a");
      const title = link.text().replace(/\s+/g, " ").trim() || null;
      const href  = link.attr("href");
      const URI   = href ? url.resolve("https://www.example.gov", href) : null;

      if (!title) return;
      results.push({ URI: URI ? [URI] : [URL], case_number: caseNumber, cite_as: citeAs, title, date: parsedDate });
    });
  });

  return results;
}
