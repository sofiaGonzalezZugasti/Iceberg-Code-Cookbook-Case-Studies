// WHEN TO USE:
// A single PDF contains multiple opinion records separated by a known marker
// (e.g. "Opinion No. X"). Split the text and produce one record per opinion.

async function parsePage({ responseBody, URL, html }) {
  if (!/pdf/i.test(responseBody.fileFormat)) return [];
  if (!html) { console.error("No HTML from filter:", URL); return []; }

  const $       = cheerio.load(html);
  const allText = $("body").text();
  const blocks  = allText.split(/(?=Opinion\s+No\.\s+\d+)/i);
  const results = [];

  for (const block of blocks) {
    if (!block.trim()) continue;
    const numberMatch = block.match(/Opinion\s+No\.\s+(\d+)/i);
    if (!numberMatch) continue;
    const identifier = "ETH " + numberMatch[1];

    const lines     = block.split("\n").map(l => l.trim()).filter(Boolean);
    const titleLine = lines.find((l, i) => i > 0 && l.length > 5 && !/^(Opinion|ETH|\d)/i.test(l));
    const title     = titleLine || null;

    const dateMatch = block.match(
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i
    );
    const date = dateMatch
      ? moment(dateMatch[0], "MMMM D, YYYY", "en").format("YYYY-MM-DD")
      : null;

    results.push({
      URI: [URL + "#" + identifier.replace(" ", "-")],
      identifier,
      title,
      date,
      originalPdf: [{ mediaObjectId: responseBody.id, locale: "en", dataType: "MEDIA" }],
    });
  }

  return results;
}
