// WHEN TO USE:
// A document may be reachable via multiple URL variants (encoded, decoded,
// re-encoded). Building all variants as the URI array prevents duplicate
// records in the workspace.

function buildURI(rawUrl) {
  return [rawUrl, decodeURI(rawUrl), encodeURI(decodeURI(rawUrl))]
    .filter((v, i, a) => a.indexOf(v) === i);
}

// Usage in parsePage:
// return [{ URI: buildURI(URL), title, ... }];
