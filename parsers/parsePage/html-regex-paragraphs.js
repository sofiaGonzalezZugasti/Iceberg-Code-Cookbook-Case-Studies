// WHEN TO USE:
// A listing page encodes all record data inline in <p> text using a consistent
// format: "OPINION 61 – 2/18/25 – Subject – Description"
// Parse each paragraph with a regex and extract PDF link from nested <a>.

function parsePage({ responseBody, URL }) {
  if (!/html/i.test(responseBody.fileFormat)) return [];
  const $ = cheerio.load(responseBody.content);
  const results = [];

  $("p").each(function () {
    const text  = $(this).text().replace(/\s+/g, " ").trim();
    const match = /^([A-Z\*]+)\s+(\d+)\s+[–\-]\s+([\d\/]+)\s+[–\-]\s+([^–\-]+?)\s+[–\-]\s+(.+)/i.exec(text);
    if (!match) return;

    const opinionNumber = match[2].trim();
    const rawDate       = match[3].trim();
    const subject       = match[4].trim();
    const description   = match[5].trim();
    const d             = moment(rawDate, ["M/D/YY", "M/D/YYYY", "MM/DD/YY", "MM/DD/YYYY"]);
    const date          = d.isValid() ? d.format("YYYY-MM-DD") : null;

    const pdfHref = $(this).find("a[href]").filter(function () {
      return /\.pdf/i.test($(this).attr("href") || "");
    }).first().attr("href");

    results.push({
      URI: pdfHref ? [url.resolve(URL, pdfHref)] : [URL],
      opinionNumber,
      subject,
      description,
      date,
    });
  });

  return results;
}
