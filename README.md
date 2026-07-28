# n8n-nodes-captchaai

An [n8n](https://n8n.io/) community node for [CaptchaAI](https://captchaai.com/). Solve reCAPTCHA, Cloudflare Turnstile, GeeTest, image CAPTCHAs and more from inside a workflow.

[Installation](#installation) · [Credentials](#credentials) · [Usage](#usage) · [Supported CAPTCHA types](#supported-captcha-types) · [Settings](#settings) · [Output](#output) · [Errors](#errors) · [Development](#development)

## Installation

In n8n, go to **Settings → Community nodes → Install** and enter:

```
n8n-nodes-captchaai
```

For a self-hosted instance you can also install it manually:

```bash
cd ~/.n8n
npm install n8n-nodes-captchaai
```

Restart n8n afterwards. The package ships with no runtime dependencies: the CaptchaAI SDK is bundled into the published build.

## Credentials

1. Sign in at [captchaai.com](https://captchaai.com/) and copy your API key from the dashboard. It is exactly 32 characters.
2. In n8n, create a new **CaptchaAI API** credential and paste the key.
3. Press **Test**. On success n8n reports how many concurrent solves your plan allows and how many are in use. A rejected key is reported straight away, so you never discover it halfway through a run.

## Usage

Add the **CaptchaAI** node, pick a **CAPTCHA Type**, and fill in the fields that appear for it. A typical login flow looks like this:

1. **HTTP Request** fetches the target page.
2. **HTML** extracts the site key.
3. **CaptchaAI** solves the CAPTCHA and returns a token.
4. **HTTP Request** submits the form with `{{ $json.solution }}` as the `g-recaptcha-response` value.

The node is also available to AI agents as a tool.

### Thread balance

**Thread Balance**, at the top of the node, reads how many solve threads your plan has free, for example `12 of 15 threads free · 3 currently in use`. It reflects whichever CaptchaAI credential is selected on that node. Nothing is selected here and the node ignores the field when it runs; it is there to size **Batch Size** against your plan before a run rather than after one fails.

n8n caches the reading rather than refetching it as you click around. After you edit the API key, flip **Refresh Thread Balance** underneath to take a fresh reading — editing a key inside a credential does not notify the node on its own. You can also open the `⋮` menu on the field and choose **Refresh List**.

### Images

Image fields accept an **image URL**, a **data URI**, or a **base64 string**. File paths and binary attachments are rejected: the node never reads files from the n8n server's disk. To use a file already in your workflow, convert it first with an **Extract from File** node and pass the base64 result in.

PNG and GIF images must be at most 1000px per side.

### Execution mode

**Sequential** solves one item at a time. **Parallel** solves items in batches of **Batch Size**. Solving is slow, often 10 to 60 seconds per CAPTCHA, so parallel is worth using for anything more than a couple of items.

Keep Batch Size at or below the thread limit of your CaptchaAI plan. Above it, the extra items fail with a thread limit error.

A failure inside a batch is isolated: its siblings still finish, and the output stays in input order. With **Continue On Fail** enabled, failed items appear in the output as error items instead of stopping the run.

## Supported CAPTCHA types

| Type | Required fields | Optional fields |
| --- | --- | --- |
| Image (Normal) | Image | Instructions, Character Set, Min/Max Length, Word Count, Case Sensitivity, Language |
| Grid | Image, Instructions, Grid Size | |
| BLS | Image 1-9, Instructions | |
| reCAPTCHA V2 | Site Key, Page URL | Action, Cookies, User Agent |
| reCAPTCHA V2 Invisible | Site Key, Page URL | Action, Cookies, User Agent |
| reCAPTCHA V2 Enterprise | Site Key, Page URL | Action, Cookies, User Agent |
| reCAPTCHA V3 | Site Key, Page URL, Action | Min Score, Cookies, User Agent |
| reCAPTCHA V3 Enterprise | Site Key, Page URL, Action | Min Score, Cookies, User Agent |
| Cloudflare Turnstile | Site Key, Page URL | Cookies, User Agent |
| Cloudflare Challenge | Page URL, plus a proxy | Cookies, User Agent |
| GeeTest | GT, Challenge, Page URL | Cookies, User Agent |
| CaptchaFox | Site Key, Page URL, plus a proxy | Cookies, User Agent |
| Friendly Captcha | Site Key, Page URL | Version |
| Lemin | Captcha ID, Div ID, Page URL | API Server |

Cloudflare Challenge and CaptchaFox cannot be solved without a proxy. Set **Proxy** and **Proxy Type** in Settings, otherwise the node fails the item before contacting the API.

The GeeTest challenge value is single use. Fetch a fresh one immediately before solving.

## Settings

Optional and collapsed by default. These apply to the whole execution.

| Setting | Default | Notes |
| --- | --- | --- |
| Max Poll Time | 180 seconds | How long to wait for a result before giving up |
| Max Retry Attempts | 5 | Retries for transient API errors. Minimum 1 |
| Proxy | none | `user:password@host:port` |
| Proxy Type | HTTP | HTTP, HTTPS, SOCKS4, or SOCKS5 |
| Include Raw API Response | off | Adds the untouched API response under `raw` |

## Output

One output item per input item:

```json
{
  "captchaType": "recaptcha_v2",
  "taskId": "77123456",
  "solution": "03AGdBq26...",
  "userAgent": "Mozilla/5.0 ..."
}
```

`solution` keeps whatever shape the CAPTCHA type produces: a token string for reCAPTCHA and Turnstile, an object for GeeTest and Lemin, an array of tile indices for Grid and BLS.

`userAgent` is present only for the types that return one, namely reCAPTCHA Enterprise, Cloudflare Challenge, and CaptchaFox. When it is there, reuse it on the follow-up request or the token is likely to be rejected.

`raw` is present only when **Include Raw API Response** is enabled.

With **Continue On Fail**, a failed item looks like this instead:

```json
{
  "error": "Captcha could not be solved",
  "errorType": "UnsolvableError",
  "captchaType": "normal",
  "taskId": "77123456"
}
```

## Errors

Every failure names the CAPTCHA type and, once the task has been submitted, the CaptchaAI task ID, so a run can be traced in your dashboard.

| Error | What it usually means |
| --- | --- |
| `InvalidKeyError` | The API key is wrong. Check the credential |
| `ValidationError` | A parameter was rejected, most often a bad site key and page URL pair |
| `ProxyError` | The proxy was rejected or is unreachable from CaptchaAI |
| `ThreadLimitError` | Your account's threads are all busy. Lower Batch Size |
| `NoThreadsError` | The account has no active plan |
| `UnsolvableError` | CaptchaAI could not solve it. You are not charged |
| `TimeoutError` | No result within Max Poll Time. Raise it for slow types |
| `NetworkError` | The API was unreachable |
| `InputValidationError` | A node field is missing or invalid, caught before any request |

**Network errors are not retried.** They fail the item immediately, by design, so a dead connection does not silently burn the poll budget. Enable **Retry On Fail** on the node if you want the whole item retried.

## Development

```bash
npm install
npm run build      # bundle to dist/ and copy icons
npm test           # vitest
npm run lint
npm run typecheck
npm run scan       # build, then run n8n's community-package verification lint
```

`npm run scan` reproduces both legs of `@n8n/scan-community-package` against the working tree: the node and credential sources, and the packed tarball. Run it before publishing, because the published package is scanned the same way.

Two build-time substitutions in `tsup.config.ts` keep the bundle inside n8n's verification rules, and both are covered by tests:

- `build/timers-shim.js` routes the bundled SDK's `setTimeout` calls through n8n's own `sleep` helper, since referencing the `setTimeout` global is not allowed in shipped code.
- `build/sdk-image-resolver.js` replaces the SDK's image helper with an equivalent that has no `node:fs` import, which is what makes the "URL or base64 only" rule airtight rather than advisory.

## License

[MIT](LICENSE.md)
