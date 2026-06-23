// WHEN TO USE:
// A site blocks requests that don't have a realistic browser User-Agent.
// Picks a random UA string on each request.
//
// NOTE: Iceberg sets a default User-Agent via HTTP Headers in Configuration.
// Only use this pattern when you need per-request randomisation.
//
// USED IN: DP71206 (US – North Carolina Ethics Opinions)

const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.121 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:54.0) Gecko/20100101 Firefox/54.0",
];

function getRandomUA() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

async function fetchURL({ canonicalURL, headers }) {
  if (!headers) headers = {};
  headers["User-agent"] = getRandomUA();
  return fetchWithCookies(canonicalURL, { method: "GET", headers }, "no-proxy");
}
