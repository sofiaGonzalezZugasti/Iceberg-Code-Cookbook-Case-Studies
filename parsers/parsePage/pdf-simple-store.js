// WHEN TO USE:
// Store the original PDF and the HTML output from the configured filter.
// No field extraction — useful when the workspace only needs the document itself.

async function parsePage({ URL, responseBody, html }) {
  if (!/pdf/i.test(responseBody.fileFormat)) return [];

  const out = {
    URI: [URL, decodeURI(URL), encodeURI(decodeURI(URL))].filter((v, i, a) => a.indexOf(v) === i),
    originalPdf: [{ mediaObjectId: responseBody.id, locale: "en", dataType: "MEDIA" }],
  };

  if (html && html.trim().length > 500) {
    out.htmlContent = { content: html, fileFormat: "text/html", locale: "en", dataType: "MEDIA" };
  }

  return [out];
}
