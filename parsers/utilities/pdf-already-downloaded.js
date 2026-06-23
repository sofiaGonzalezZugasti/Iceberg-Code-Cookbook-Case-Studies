// WHEN TO USE:
// A listing page contains records that link to PDFs, and you only want to
// import a record if its PDF has already been crawled and stored.
// Avoids importing incomplete records.
//
// WARNING: Makes one GraphQL call per record. Slow on large listing pages.
// Only use when importing orphan records causes data quality issues.

const pdfAlreadyDownloaded = async (URL) => {
  try {
    return await doWeHaveMediaObject({ URL });
  } catch (e) {
    return false;
  }
};

async function doWeHaveMediaObject({ URL }) {
  const query = `
    query {
      viewer {
        crawledURLs(first: 1, q: "${URL}") {
          edges { node { id } }
        }
      }
    }`;
  const result = await graphql(query);
  return !!(result?.viewer?.crawledURLs?.edges?.[0]?.node?.id);
}

// Usage in parsePage:
// const confirmed = [];
// for (const record of records) {
//   if (await pdfAlreadyDownloaded(record.pdfUrl)) confirmed.push(record);
// }
// return confirmed;
