// WHEN TO USE:
// The PDF filter is pdf2htmlex (not pdftotext). The output is an HTML file
// with content split across many .t div elements. Bold text uses the ff1 class.
//
// NOTE: Class names (.t, ff1) depend on the pdf2htmlEX version and font mapping.
// If bold detection fails, inspect the raw HTML output and adjust selectors.

function pdf2htmlToContent($) {
  const parts = [];
  let lines   = [];

  $(".t").each((i, el) => {
    const text = $(el).text().trim();
    if (!text) return;

    if ($(el).hasClass("ff1")) {
      if (lines.length) { parts.push(`<p>${lines.join(" ")}</p>`); lines = []; }
      parts.push(`<p><strong>${text}</strong></p>`);
    } else {
      lines.push(text);
    }
  });

  if (lines.length) parts.push(`<p>${lines.join(" ")}</p>`);
  return parts.join("\n");
}

// Usage in parsePage:
// const $ = cheerio.load(html, { decodeEntities: false });
// const body = pdf2htmlToContent($);
