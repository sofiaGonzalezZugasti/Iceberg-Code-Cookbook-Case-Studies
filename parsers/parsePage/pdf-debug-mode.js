// WHEN TO USE:
// During development when you don't know which filter returns usable content.
// Stores the first 200 chars of each filter's output as debugInfo so you can
// inspect results in the workspace.
//
// WARNING: Never ship debug mode to production — it makes unnecessary filter
// calls on every URL. Replace with the production parser once you know which
// filter to use.

async function parsePage({ URL, responseBody }) {
  if (!/pdf/i.test(responseBody.fileFormat)) return [];

  const debugInfo = {};

  for (const filter of ["pdftotext_raw", "pdf2htmlEx", "pdftohtmlExFallback", "tesseractOCREnglish"]) {
    try {
      const text = await runRemoteFilter({ URL, filter });
      debugInfo[filter] = text ? text.substring(0, 200) : "EMPTY";
    } catch (e) {
      debugInfo[filter + "Error"] = e.message;
    }
  }

  return [{
    URI: [URL, decodeURI(URL), encodeURI(decodeURI(URL))].filter((v, i, a) => a.indexOf(v) === i),
    originalPdf: [{ mediaObjectId: responseBody.id, locale: "en", dataType: "MEDIA" }],
    debugInfo,
    sourceUrl: URL,
  }];
}
