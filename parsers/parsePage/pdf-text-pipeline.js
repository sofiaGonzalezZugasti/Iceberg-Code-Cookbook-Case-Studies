// WHEN TO USE:
// You need searchable text from the PDF.
// Tries pdftotext first (fast, accurate for digital PDFs),
// falls back to OCR for scanned documents.
//
// WARNING: Always return [] inside catch — a thrown exception breaks the job.
//
// USED IN: DP70975 (US – New Hampshire Executive Orders)

async function parsePage({ URL, responseBody, html }) {
  if (!/pdf/i.test(responseBody.fileFormat)) {
    console.error("Skipping non-PDF:", URL);
    return [];
  }

  const locale   = "en"; // change to "es" for Spanish sources
  const dataType = "MEDIA";

  const out = {
    URI: [URL, decodeURI(URL), encodeURI(decodeURI(URL))].filter((v, i, a) => a.indexOf(v) === i),
    originalPdf: [{ mediaObjectId: responseBody.id, locale, dataType }],
  };

  // 1. Fetch HTML from filter if not already provided
  if (!html) {
    try {
      html = await runRemoteFilter({ URL, filter: "pdf2htmlEx" });
    } catch (e) {
      console.error("pdf2htmlEx failed:", e);
    }
  }
  out.htmlContent = html
    ? { content: html, fileFormat: "text/html", locale, dataType }
    : null;

  // 2. Extract plain text: pdftotext → tesseract fallback
  try {
    let text = await runRemoteFilter({ URL, filter: "pdftotext_raw" });
    if (!text?.trim()) text = await runRemoteFilter({ URL, filter: "tesseractOCREnglish" });
    if (!text?.trim()) text = await runRemoteFilter({ URL, filter: "tesseractOCR" });

    if (text?.mediaObjectId) {
      text.locale = locale;
      out.text = text;
    } else if (typeof text === "string" && text.trim()) {
      out.text = { content: text, locale, fileFormat: "text/plain", dataType };
    } else {
      out.text = null;
    }

    return [out];
  } catch (err) {
    console.error("Text extraction failed:", err?.message);
    return [];
  }
}
