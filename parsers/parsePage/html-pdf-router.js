// WHEN TO USE:
// One parser handles both the HTML detail page and the PDF it links to.
// Route by responseBody.fileFormat at the top.
//
// USED IN: DP71206 (US – North Carolina Ethics Opinions)

function parsePage({ responseBody, URL, html }) {
  if (/pdf/i.test(responseBody.fileFormat)) {
    const out = {
      URI: [URL, decodeURI(URL), encodeURI(decodeURI(URL))].filter((v, i, a) => a.indexOf(v) === i),
      originalPdf: [{ mediaObjectId: responseBody.id, locale: "en", dataType: "MEDIA" }],
    };
    if (html) out.htmlContent = { content: html, fileFormat: "text/html", locale: "en", dataType: "MEDIA" };
    return [out];
  }

  return parseHTMLPage(responseBody.content, URL);
}

function parseHTMLPage(content, URL) {
  const $ = cheerio.load(content);
  const title = $("h1").first().text().replace(/\s+/g, " ").trim() || null;
  if (!title) return [];
  $("header, footer, nav").remove();
  return [{ URI: [URL], title, body: $("body").html() }];
}
