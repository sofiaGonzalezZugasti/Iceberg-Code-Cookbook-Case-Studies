// WHEN TO USE:
// Content is inside a named CMS container (DNN #dnn_ContentPane, WordPress #content)
// and records are grouped under h2 topic headers with ul lists.

function parsePage({ responseBody, URL }) {
  const $ = cheerio.load(responseBody.content);
  const results = [];

  const container = $("#dnn_ContentPane"); // adjust selector to your CMS
  if (!container.length) { console.error("Container not found for", URL); return []; }

  let currentTopic = null;

  container.find("h2, ul").each(function () {
    const tag = $(this).prop("tagName").toLowerCase();

    if (tag === "h2") {
      currentTopic = $(this).text().replace(/\s+/g, " ").trim() || null;
      return;
    }

    $(this).find("li").each(function () {
      const li     = $(this);
      const strong = li.find("strong").first();

      const opinionNumber = strong.length
        ? strong.text().replace(/:/g, "").replace(/\s+/g, " ").trim() || null
        : (/^([\w]+)/i.exec(li.text().replace(/\s+/g, " ").trim()) || [])[1] || null;

      const anchor  = li.find("a[href]").first();
      const pdfHref = anchor.attr("href") || null;
      const pdfUrl  = pdfHref ? url.resolve(URL, pdfHref) : null;
      const title   = anchor.length
        ? anchor.text().replace(/\s+/g, " ").trim() || null
        : li.text().replace(strong.text(), "").replace(/:/g, "").replace(/\s+/g, " ").trim() || null;

      if (!opinionNumber && !title) return;

      results.push({
        URI: pdfUrl ? [pdfUrl] : [URL],
        opinionNumber,
        topic: currentTopic,
        title,
        sourceUrl: URL,
      });
    });
  });

  return results;
}
