// WHEN TO USE:
// Required for any parser that needs to extract text from a PDF.
// Uses Iceberg's internal GraphQL API to request the output of a server-side
// filter (pdftotext, OCR, pdf2htmlEX) for a previously crawled URL.
//
// AVAILABLE FILTERS:
//   pdftotext_raw        — fast text extraction for digitally-born PDFs
//   pdf2htmlEx           — converts PDF to HTML preserving layout
//   pdftohtmlExFallback  — alternative pdf2htmlEX invocation
//   tesseractOCR         — OCR with auto-detected language
//   tesseractOCREnglish  — OCR forced to English
//   tesseractOCRSpanish  — OCR forced to Spanish

const runRemoteFilter = async function ({ URL, id, filter }) {
  let textContent  = "";
  const URLId      = URL && "H" + new Buffer(URL).toString("base64");
  const URLIdN     = URL && "H" + sha256(URL) + ".N";
  const query      = `
    query {
      nodes(ids: ["${URL ? `${URLId}", "${URLIdN}` : `${id}`}"]) {
        id
        ... on CrawledURL {
          lastSuccessfulRequest {
            outputForFilter(filter: "${filter}")
          }
        }
      }
    }`;

  const resp   = await graphql(query);
  const node   = resp.nodes.filter(n => n)[0];
  const output = node
    ?.lastSuccessfulRequest
    ?.outputForFilter?.[0]
    ?.filterOutput
    ?.content;

  if (output) textContent += output;
  return textContent;
};
