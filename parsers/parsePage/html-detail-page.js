// WHEN TO USE:
// Each URL corresponds to one document. Extract fields using CSS selectors
// defined as constants at the top for easy maintenance.
// Return [] if the page has no title — skip non-document pages silently.

const TITLE_SELECTOR     = "h1.title";
const SUBJECT_SELECTOR   = "h3.h2";
const BODY_SELECTOR      = "div.content__container";
const DATE_META_SELECTOR = 'meta[property="datePublished"]';

function parsePage({ responseBody, URL }) {
  if (!responseBody?.content) return [];
  const $ = cheerio.load(responseBody.content);

  const title = $(TITLE_SELECTOR).text().replace(/\s+/g, " ").trim() || null;
  if (!title) return [];

  const rawDate = $(DATE_META_SELECTOR).attr("content") || null;
  const d       = rawDate ? moment(rawDate) : null;
  const date    = d?.isValid() ? d.format("YYYY-MM-DD") : null;

  const subject = $(SUBJECT_SELECTOR).text().trim() || null;

  $("header, footer, nav, script, style").remove();
  const body = $(BODY_SELECTOR).html() || null;

  return [{ URI: [URL], title, date, subject, body }];
}
