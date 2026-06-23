// WHEN TO USE:
// fetchURL produces both HTML listing pages and JSON API responses from the
// same crawler. Dispatch by contentType and handle each format separately.
// On page 1 of JSON responses, generate all subsequent pagination URLs.
//
// USED IN: DP71206 (US – North Carolina Ethics Opinions)

function discoverLinks({ content, contentType, canonicalURL, requestURL }) {
  const links    = [];
  const isListing = /page=(\d+)/i.exec(canonicalURL);
  const page     = isListing ? parseInt(isListing[1]) : 1;

  if (/html|plain/i.test(contentType)) {
    const $ = cheerio.load(content);
    $(".litResults a[href]").each(function () {
      const href = $(this).attr("href");
      if (href) links.push(url.resolve(requestURL, href));
    });

  } else if (/json/i.test(contentType)) {
    const json = JSON.parse(content);
    if (isListing) {
      if (page === 1) {
        const total = json.data.totalCount || 1;
        const pages = Math.ceil(total / 20);
        for (let i = 2; i <= pages; i++) {
          links.push(canonicalURL.replace(/page=\d+/, `page=${i}`));
        }
      }
      (json.data.results || []).forEach(obj => {
        if (obj.url) links.push(url.resolve(requestURL, obj.url));
      });
    }
  }

  return links;
}
