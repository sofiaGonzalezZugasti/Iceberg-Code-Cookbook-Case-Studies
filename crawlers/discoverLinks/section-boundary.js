// WHEN TO USE:
// A page contains multiple sections (e.g. "active orders" and "archived orders")
// identified by anchor hrefs, and you only want links from specific sections.
// Walk all <a> tags in DOM order, tracking which section you are in.
//
// USED IN: US – Indiana Executive Orders (DP70959)

function discoverLinks({ content, canonicalURL }) {
  const $ = cheerio.load(content);
  const links = [];
  let currentSection = null;

  $("a").each(function () {
    const href = $(this).attr("href") || "";

    // Update section state based on anchor landmarks — adjust hrefs to match source
    if (href.includes("#Active_Orders"))   { currentSection = "wanted";   return; }
    if (href.includes("#Current_Orders"))  { currentSection = "wanted";   return; }
    if (href.includes("#Non_Active"))      { currentSection = "unwanted"; return; }
    if (href.includes("#Archived"))        { currentSection = "unwanted"; return; }

    // Collect PDF links only while inside a wanted section
    if (currentSection === "wanted" && /\/files\/.*\.pdf$/i.test(href)) {
      if (/\/sub-reports\//i.test(href)) return; // exclude sub-files
      links.push(url.resolve(canonicalURL, href));
    }
  });

  return links;
}
