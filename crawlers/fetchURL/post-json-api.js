// WHEN TO USE:
// A listing page is backed by a private JSON search API that requires a POST
// with custom security headers (Azure Application Insights traceparent, sec-ch-ua).
//
// USED IN: DP71206 (US – North Carolina Ethics Opinions)

const search = async function ({ page, canonicalURL, headers }) {
  const customHeaders = {
    "content-type": "application/json",
    "origin": "https://www.example.com",
    "referer": "https://www.example.com/search/?status=adopted",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
  };

  const body = JSON.stringify({
    IndexGuid: "YOUR-GUID-HERE", // inspect the network request to find this
    Term: [],
    Status: ["adopted"],
    StartDate: "",
    EndDate: "",
    PageNumber: page,
    SortBy: "date-desc",
  });

  const opts = {
    method: "POST",
    body,
    headers: Object.assign(customHeaders, headers),
  };

  const resp = await fetchWithCookies(
    "https://www.example.com/api/search/",
    opts,
    "no-proxy"
  );

  return { canonicalURL, response: resp };
};
