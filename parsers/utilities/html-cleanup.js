// WHEN TO USE:
// Strip unwanted tags (scripts, styles, iframes) while preserving readable
// content structure. Also removes empty paragraphs and excessive whitespace.
//
// NOTE: sanitizeHtml must be available as a global in the Iceberg runtime.

function cleanHtml(rawHtml) {
  if (!rawHtml) return null;
  return sanitizeHtml(rawHtml, {
    allowedTags: [
      "p", "h1", "h2", "h3", "h4",
      "b", "strong", "em", "i",
      "ul", "ol", "li",
      "a", "br",
      "table", "tr", "td", "th"
    ],
    allowedAttributes: { "a": ["href"] },
  })
  .replace(/\t+/g, "")
  .replace(/\n\s*\n+/g, "\n")
  .replace(/<p>\s*<\/p>/g, "")
  .trim();
}

// Extract plain text from HTML (for indexing or title fallback)
function htmlToText(rawHtml) {
  if (!rawHtml) return null;
  const $ = cheerio.load(rawHtml);
  return $("body").text().replace(/\s+/g, " ").trim();
}
