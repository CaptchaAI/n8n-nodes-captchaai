# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Thread Balance field at the top of the node, showing how many solve threads
  the selected credential has free. A Refresh Thread Balance toggle underneath
  forces a new reading after the API key is edited; n8n does not reload the
  field on its own when only the key inside a credential changes.
- A short notice at the top of the Settings section explaining what the section
  is for.

### Fixed

- The API key is now trimmed before it reaches the API. A key pasted with a
  leading or trailing space used to pass the SDK's length check, which measures
  the trimmed key, and then be rejected by the API as "Key must be 32
  characters" despite being exactly 32 characters.
- A key of nothing but whitespace is now refused with a clear message before
  any request is made. n8n's `required` flag only tests for a non-empty string,
  so such a key saved cleanly and showed no issue on the credential.

## [1.0.0] - 2026-07-27

Initial release.

### Added

- CaptchaAI node supporting all 14 CAPTCHA types the CaptchaAI API offers:
  Image (Normal), Grid, BLS, the five reCAPTCHA variants, Cloudflare Turnstile,
  Cloudflare Challenge, GeeTest, CaptchaFox, Friendly Captcha, and Lemin.
- A single flat CAPTCHA Type dropdown that reveals only the fields the chosen
  type needs.
- CaptchaAI API credential with a Test button that checks the key against the
  account's thread info.
- Sequential and parallel execution modes with a configurable batch size, with
  per-item failure isolation and output that always matches input order.
- Task IDs attached to every failure once a task has been submitted.
- Optional Settings for max poll time, retry attempts, proxy, proxy type, and
  including the raw API response.
- Usable as a tool by AI agents.

### Notes

- The package ships with no runtime dependencies. `captchaai-javascript` is
  bundled into the published build.
- Image inputs accept a URL, a data URI, or a base64 string. Reading files from
  the n8n server's disk is not supported and is blocked at both the field
  validation and bundling layers.
- Network failures are not retried. Enable Retry On Fail on the node to retry
  the whole item.

[Unreleased]: https://github.com/CaptchaAI/n8n-nodes-captchaai/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/CaptchaAI/n8n-nodes-captchaai/releases/tag/v1.0.0
