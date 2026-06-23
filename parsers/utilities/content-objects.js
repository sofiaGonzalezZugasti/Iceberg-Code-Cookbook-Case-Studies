// WHEN TO USE:
// Iceberg expects content in a specific shape depending on type.
// Use these helpers to ensure the format is always correct.

// HTML content (for display in the workspace)
function htmlContent(content, locale = "en") {
  if (!content) return null;
  return { content, fileFormat: "text/html", locale, dataType: "MEDIA" };
}

// Plain text content (for search indexing)
function textContent(content, locale = "en") {
  if (!content) return null;
  return { content, fileFormat: "text/plain", locale, dataType: "MEDIA" };
}

// Reference to an already-stored PDF
// Use when the workspace should display the original PDF file
function pdfRef(responseBody, locale = "en") {
  if (!responseBody?.id) return null;
  return [{ mediaObjectId: responseBody.id, locale, dataType: "MEDIA" }];
}
