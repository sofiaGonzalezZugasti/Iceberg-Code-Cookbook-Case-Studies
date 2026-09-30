// WHEN TO USE:
// A search form (or API call) requires a Google reCAPTCHA v2 token (`g-recaptcha-response`)
// and the site really validates it, so stealth browsers keep landing on the image challenge.
//
// HOW IT WORKS:
// The 2captcha API solves the reCAPTCHA on 2captcha's side and returns a token; the crawler
// only pastes that token into its own request. The API key is read from AWS Secrets Manager.
// Traffic to Google never goes through BrightData, only the request to the target site does.
//
// WARNINGS / GOTCHAS:
// - This is NOT the `zone-2captcha` proxy zone nor `resolveCaptcha(imageBuffer)`: those only
//   handle image captchas / WAF JS challenges. Google traffic through BrightData is forbidden.
// - Use the v2 API (`createTask` / `getTaskResult`) with the key in the JSON body. The legacy
//   API (`in.php?key=...`) puts the key in the URL, and Iceberg logs every request URL.
// - `RecaptchaV2TaskProxyless`: works when the site accepts a token solved from another IP.
//   If the site binds the token to the IP, escalate to the platform team — never hardcode
//   BrightData credentials to pass a proxy to 2captcha.
// - The token expires after ~2 minutes and is single use: one token per submit, request it
//   in parallel with the page loads, and discard it if it is older than ~100 s.
// - Solving takes 15-120 s. Test URL times out (504): test with a Crawl Job on a few seeds.
// - Every token costs money. Get explicit approval for the ticket before a full historical crawl.
// - After a real run, search the logs for the key and confirm 0 occurrences.

// Secret id and field name: ask the platform team (Content team / Iceberg Content group).
const TWOCAPTCHA_SECRET_ID = '<2captcha-secret-id>';
const TWOCAPTCHA_SECRET_FIELD = '<api-key-field>';
const TWOCAPTCHA_API_URL = 'https://api.2captcha.com';
const CAPTCHA_POLL_INTERVAL_MS = 5000;
const CAPTCHA_MAX_POLLS = 36;
const CAPTCHA_MAX_SUBMITS = 3;
const TOKEN_MAX_AGE_MS = 100000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getTwoCaptchaApiKey() {
  const secret = await getSecretsManagerValue(TWOCAPTCHA_SECRET_ID);
  return JSON.parse(secret.SecretString)[TWOCAPTCHA_SECRET_FIELD];
}

async function callTwoCaptcha(method, body) {
  const response = await fetchWithCookies(`${TWOCAPTCHA_API_URL}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.json();
}

async function submitRecaptchaTask({ apiKey, websiteURL, websiteKey, userAgent }) {
  const task = {
    type: 'RecaptchaV2TaskProxyless',
    websiteURL,
    websiteKey,
    isInvisible: false,
    ...(userAgent && { userAgent }),
  };

  for (let submitAttempt = 1; submitAttempt <= CAPTCHA_MAX_SUBMITS; submitAttempt++) {
    const submission = await callTwoCaptcha('createTask', { clientKey: apiKey, task });
    if (submission.errorId === 0) return submission.taskId;
    if (submission.errorCode !== 'ERROR_NO_SLOT_AVAILABLE') throw new Error(`2captcha createTask: ${submission.errorCode}`);
    await sleep(CAPTCHA_POLL_INTERVAL_MS);
  }
  throw new Error('2captcha createTask: ERROR_NO_SLOT_AVAILABLE after retries');
}

async function pollRecaptchaToken(apiKey, taskId) {
  for (let attempt = 1; attempt <= CAPTCHA_MAX_POLLS; attempt++) {
    await sleep(CAPTCHA_POLL_INTERVAL_MS);
    const result = await callTwoCaptcha('getTaskResult', { clientKey: apiKey, taskId });
    if (result.errorId !== 0) throw new Error(`2captcha getTaskResult: ${result.errorCode}`);
    if (result.status === 'ready') return result.solution.gRecaptchaResponse;
  }
  throw new Error(`2captcha: no token after ${CAPTCHA_MAX_POLLS} polls`);
}

// One retry on ERROR_CAPTCHA_UNSOLVABLE; any other error is thrown.
async function solveRecaptcha(options) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const taskId = await submitRecaptchaTask(options);
    try {
      const token = await pollRecaptchaToken(options.apiKey, taskId);
      return { taskId, token, solvedAt: Date.now() };
    } catch (error) {
      if (attempt === 2 || !/ERROR_CAPTCHA_UNSOLVABLE/.test(error.message)) throw error;
    }
  }
}

// Tell 2captcha whether the site accepted the token (improves worker quality, refunds bad ones).
async function reportCaptchaResult(apiKey, taskId, accepted) {
  try {
    await callTwoCaptcha(accepted ? 'reportCorrect' : 'reportIncorrect', { clientKey: apiKey, taskId });
  } catch (error) {
    console.warn(`2captcha report failed: ${error.message}`);
  }
}


// --- Usage: one search submit ------------------------------------------------
// Adapt SEARCH_URL, SITEKEY, the form fields and isResultsPage() to the source.
// The sitekey is the `data-sitekey` attribute of the `.g-recaptcha` element.

const SEARCH_URL = 'https://www.example.com/search.aspx';
const SITEKEY = '<data-sitekey of the page>';

function isResultsPage(html) {
  // Check a marker that only the real results page has (record counter, "no records" notice).
  // Never trust the HTTP status: a rejected token usually returns 200 with the form again.
  return /record\(s\) returned|no records returned/i.test(html);
}

async function submitSearchWithToken({ form, headers, zone }) {
  const apiKey = await getTwoCaptchaApiKey();
  const userAgent = headers['User-Agent'] || headers['user-agent'] || '';

  // Start solving right away; load the form pages while 2captcha works.
  const captchaPromise = solveRecaptcha({ apiKey, websiteURL: SEARCH_URL, websiteKey: SITEKEY, userAgent });
  captchaPromise.catch(() => {});

  // ... GET the form / postbacks here with the same `zone` (fixed session) ...

  const { taskId, token, solvedAt } = await captchaPromise;
  if (Date.now() - solvedAt > TOKEN_MAX_AGE_MS) throw new Error('reCAPTCHA token expired before submit');

  const response = await fetchWithCookies(SEARCH_URL, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded', Referer: SEARCH_URL },
    body: querystring.stringify({ ...form, 'g-recaptcha-response': token }),
  }, zone);
  const html = await response.text();

  const accepted = isResultsPage(html);
  await reportCaptchaResult(apiKey, taskId, accepted);
  return { accepted, html };
}
