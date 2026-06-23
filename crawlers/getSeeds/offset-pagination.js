// WHEN TO USE:
// The source paginates content using a ?start=N or ?offset=N query parameter
// and you know (or can estimate) the total number of items.
// Generates all page seeds upfront so the crawler queues them immediately.
//
// USED IN: DP72519 (EC – Blogs López Ribadeneira Mora)

function getSeeds() {
  const base     = "https://www.example.com/publications";
  const step     = 10;
  const maxItems = 200; // estimate; set conservatively high
  const seeds    = [`${base}/articles`]; // page 0 (no offset param)

  for (let offset = step; offset <= maxItems; offset += step) {
    seeds.push(`${base}/articles?start=${offset}`);
  }

  return seeds;
}
