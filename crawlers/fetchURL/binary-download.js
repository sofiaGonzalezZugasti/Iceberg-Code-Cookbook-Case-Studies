// WHEN TO USE:
// The source serves PDFs or Word docs via a URL that returns
// application/octet-stream instead of the correct MIME type, or when you
// need to validate that the file downloaded completely (content-length check).
//
// USED IN: DP71206 (US – North Carolina Ethics Opinions)

const binaryDownload = async function ({ canonicalURL, requestURL, headers, requestOptions }) {
  const resp = await fetchWithCookies(
    requestURL || canonicalURL,
    requestOptions || { method: "GET", headers },
    "no-proxy"
  );

  let type = resp.headers.get("content-type");

  // Fix octet-stream: infer real type from Content-Disposition filename
  if (/octet/i.test(type)) {
    const disposition = resp.headers.get("content-disposition") || "";
    if (/\.pdf/i.test(disposition))       type = "application/pdf";
    else if (/\.docx/i.test(disposition)) type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    else if (/\.doc/i.test(disposition))  type = "application/msword";
    if (type) resp.headers.set("content-type", type);
  }

  if (resp.ok && /pdf|word/i.test(type)) {
    const contentSize  = parseInt(resp.headers.get("content-length") || "-1");
    const buffer       = await resp.buffer();
    const bufferLength = buffer.length;

    if (contentSize < 0 || bufferLength === contentSize) {
      return { canonicalURL, response: new fetch.Response(buffer, resp) };
    } else if (contentSize === 0 || bufferLength === 0) {
      resp.ok = false; resp.status = 404;
      resp.statusText = `EMPTY DOCUMENT: declared=${contentSize} actual=${bufferLength}`;
      return { canonicalURL, response: new fetch.Response(resp.statusText, resp) };
    } else {
      resp.ok = false; resp.status = 504;
      resp.statusText = `INCOMPLETE DOWNLOAD: declared=${contentSize} actual=${bufferLength}`;
      return { canonicalURL, response: new fetch.Response(resp.statusText, resp) };
    }
  }

  resp.ok = false; resp.status = 505;
  resp.statusText = `NOT PDF OR WORD: status=${resp.status} type=${type}`;
  return { canonicalURL, response: new fetch.Response(resp.statusText, resp) };
};
