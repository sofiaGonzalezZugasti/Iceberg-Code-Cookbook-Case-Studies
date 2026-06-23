// WHEN TO USE:
// Small utilities for normalising extracted text before storing it.

// Remove "Por: " and "Ab. " prefixes from author strings
function cleanAuthor(raw) {
  if (!raw) return null;
  return raw
    .replace(/^Por:\s*/i, "")
    .replace(/\bAb\.\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim() || null;
}

// Remove trailing dot from titles
function removeDot(str) {
  return str?.replace(/\.$/, "").trim() || null;
}

// Collapse all whitespace to single spaces
function normaliseWhitespace(str) {
  return str?.replace(/\s+/g, " ").trim() || null;
}
