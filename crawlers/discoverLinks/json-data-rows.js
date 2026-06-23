// WHEN TO USE:
// Use alongside the DataTables/WDT fetchURL pattern.
// Parses the JSON data array returned by the AJAX endpoint and extracts
// document URLs from the appropriate column index.
//
// NOTE: Column indices (row[0], row[6]) are source-specific.
// Always inspect the raw JSON response first to identify the right columns.
//
// USED IN: DP74366 variant (US – Court of Appeals, Federal Circuit)

const BASE        = "https://www.example.com";
const CUTOFF_YEAR = 2024;

function discoverLinks({ content }) {
  let json;
  try { json = JSON.parse(content); } catch (e) { return []; }
  if (!Array.isArray(json?.data)) return [];

  const links = [];
  for (const row of json.data) {
    const year = parseInt(String(row[0]).split("/")[2], 10); // col 0 = "MM/DD/YYYY"
    if (year < CUTOFF_YEAR) continue;
    if (!row[6]) continue; // col 6 = document URL — adjust index to your source
    links.push(url.resolve(BASE, row[6]).split("#")[0]);
  }

  return links;
}
