// WHEN TO USE:
// Scanned documents from the 1970s–1990s where OCR output contains systematic
// character substitution errors. Clean OCR output before field extraction.
// Add source-specific replacements as you review output.
//
// USED IN: DP70956 (US – Florida Executive Orders, pre-1990 PDFs)

const cleanOCR = (text) => text
  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
  .replace(/@media[\s\S]*?\{[\s\S]*?\}/gi, "")
  .replace(/\.[a-z0-9]+\{[^}]*\}/gi, "")
  .replace(/<[^>]+>/g, " ")
  .replace(/^[\s\S]*?(?=(?:WHEREAS|NOW,?\s+THEREFORE|EXECUTIVE\s+ORDER))/i, "")
  // Fix common OCR substitutions
  .replace(/HHEREAS|VIHEREAS|wHEREAS|<JHEREAS|1-"VHEREAS/gi, "WHEREAS")
  .replace(/NU1BER|NUtvlBER/gi, "NUMBER")
  .replace(/NOt-1,?\s+TIIEREFOM\s*1?/gi, "NOW, THEREFORE,")
  .replace(/NOt-1,?\s+THEREFORE|NOH,?\s+THEREFORE|NOvl,?\s+THEREFORE/gi, "NOW, THEREFORE,")
  .replace(/£!larch/gi, "March")
  .replace(/£!lay/gi, "May")
  .replace(/Janua ry/gi, "January")
  .replace(/Februa ry/gi, "February")
  .replace(/(\w+)-\s+(\w+)/g, "$1$2") // rejoin hyphenated line breaks
  .replace(/[~`\\]/g, "")
  .replace(/,\s*,/g, ",")
  .replace(/(\.\s*){2,}/g, " ")
  .replace(/\s+/g, " ")
  .trim();

// Extract body text from "NOW, THEREFORE" to signature block
const cleanBody = (text) => text
  .replace(/^[^N]*(?=NOW,?\s+THEREFORE)/i, "")
  .replace(/\$IN\s+TESTI[\s\S]*$/i, "")
  .replace(/IN\s+TESTI[\s\S]*$/i, "")
  .replace(/ATTEST:[\s\S]*$/i, "")
  .replace(/DISTRIBUTION:[\s\S]*$/i, "")
  .replace(/[\/\~\`]{3,}/g, "")
  .replace(/\s+/g, " ")
  .trim();

// Usage inside parsePage after runRemoteFilter:
// const cleanText = cleanOCR(extractedText);
// const body      = cleanBody(cleanText);
