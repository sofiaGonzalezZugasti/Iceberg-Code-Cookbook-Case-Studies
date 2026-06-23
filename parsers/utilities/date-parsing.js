// WHEN TO USE:
// Source dates come in inconsistent or unknown formats.
// Tries a list of common formats in order. Returns null if none match.
// Never throws — always validate the result before using it.
//
// NOTE: Pass the correct locale for month name parsing:
//   'es' for Spanish, 'en' for English, 'fr' for French
// A wrong locale causes month names to fail silently and return null.

function parseDate(raw, locale = "es") {
  if (!raw) return null;
  const formats = [
    "DD/MM/YYYY", "D/M/YYYY",
    "DD-MM-YYYY", "YYYY-MM-DD",
    "D MMMM YYYY", "DD MMMM YYYY",
    "MMMM D, YYYY", "MMMM DD, YYYY",
    "YYYY-MM-DDTHH:mm:ssZ",
  ];
  const d = moment(raw.trim(), formats, locale);
  return d.isValid() ? d.format("YYYY-MM-DD") : null;
}

// Extract year only (when full date is unavailable)
function extractYear(dateString) {
  const match = dateString?.match(/\b(\d{4})\b/);
  return match ? match[1] : null;
}
