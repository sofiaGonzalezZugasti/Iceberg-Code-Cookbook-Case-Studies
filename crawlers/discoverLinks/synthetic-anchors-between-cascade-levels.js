// ============================================================================
// WHEN TO USE THIS
// You are fanning a crawl out across several levels (seed -> page -> record)
// and need each level to queue the next. fetchURL cannot enqueue URLs directly;
// only link discovery can.
//
// HOW IT WORKS
// Each level emits HTML containing real <a href> anchors for the next level,
// and discoverLinks resolves them, filters by path and returns them. Levels are
// told apart by path so the filter cannot accidentally queue the wrong one.
//
// WARNINGS / GOTCHAS
// - The anchors must be real <a href>. A URL inside an onclick, a data-* or a
//   JS string is not discovered by anything.
// - Return ABSOLUTE URLs resolved with url.resolve, never string concatenation.
// - Bail out early for binaries. Without the contentType guard cheerio tries
//   to parse a PDF as HTML and fills the log with noise.
// - "discoveredLinks= N matchingLinks= 0" in the job log means this hook works
//   and the CRAWLER WHITELIST is dropping everything. Every level needs its own
//   whitelist line or it is discovered and thrown away silently.
// - Anchors injected into a response a parser also reads should be empty and
//   carry no id, so they contribute nothing to any extracted text and are not
//   mistaken for the page's own links.
// ============================================================================

function discoverLinks({ content, contentType, canonicalURL, requestURL }) {
  if (!/html/i.test(contentType || '')) return [];
  if (!content) return [];

  const $ = cheerio.load(content);
  const base = requestURL || canonicalURL;
  const out = [];

  $('a[href]').each(function () {
    const href = $(this).attr('href');
    if (!href || href === '#' || /^javascript:/i.test(href)) return;

    const abs = url.resolve(base, href);

    if (/\/lista\.html\?/.test(abs) || /\/documento_oficial\.pdf\?doc=/.test(abs)) {
      out.push(abs.split('#')[0]);
    }
  });

  console.log(`discoverLinks [${canonicalURL}]: ${out.length} enlaces`);
  return out;
}
