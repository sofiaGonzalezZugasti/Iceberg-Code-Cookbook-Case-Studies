// WHEN TO USE:
// The source mixes HTML pages and PDF files and you only want to queue PDFs.
// Filters by URL path pattern and file extension.
// Logs the count of discovered PDFs for monitoring.
//
// USED IN: DP74366 (US – Court of Appeals, 5th Circuit)

function discoverLinks({ content, contentType, canonicalURL }) {
  if (!/html|plain/i.test(contentType)) return [];

  const $ = cheerio.load(content);
  const links = [];

  $("a[href]").each(function () {
    const href = $(this).attr("href");
    if (!href || href.includes("#")) return;
    if (!/\/opinions\/(pub|unpub)\//i.test(href)) return; // adjust path pattern
    if (!/\.pdf$/i.test(href)) return;
    const abs = href.startsWith("http") ? href : "https://www.example.com" + href;
    links.push(abs);
  });

  console.log(`discoverLinks [${canonicalURL}]: ${links.length} PDFs found`);
  return links;
}
