// WHEN TO USE:
// The minimal version. Use as a starting point when the default extractor
// is not sufficient but no special filtering is needed yet.

function discoverLinks({ content, contentType, canonicalURL }) {
  if (contentType !== "text/html") return [];
  const $ = cheerio.load(content);
  const links = [];
  $("a[href]").each(function () {
    links.push(url.resolve(canonicalURL, $(this).attr("href")));
  });
  return links;
}
