// WHEN TO USE:
// A single crawler handles multiple URL types (binary files, listing pages,
// detail pages) and each type needs different fetch logic.
// Route by URL pattern at the top of fetchURL.
//
// USED IN: DP71206 (US – North Carolina Ethics Opinions)

async function fetchURL({ canonicalURL, headers }) {
  // Guard: reject malformed double-protocol URLs
  if (/https?:.*https?:/i.test(canonicalURL)) {
    console.error("Rejecting malformed URL:", canonicalURL);
    return [];
  }

  // Route 1: binary files
  if (/\.(pdf|docx?)\b/i.test(canonicalURL)) {
    return [await binaryDownload({ canonicalURL, headers })];
  }

  // Route 2: paginated search/listing endpoint
  const match = /\?status=adopted(?:&page=(\d+))?$/i.exec(canonicalURL);
  if (match) {
    const page = match[1] ? parseInt(match[1]) : 1;
    return [await search({ page, canonicalURL, headers })];
  }

  // Route 3: standard HTML page
  const resp = await fetchWithCookies(canonicalURL, { method: "GET", headers }, "no-proxy");
  return [{ canonicalURL, response: resp }];
}
