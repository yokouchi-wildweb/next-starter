---
paths:
  - "src/lib/url/**"
---
# lib/url
what: the closed lib for this app's own origin (getAppBaseUrl: reads the runtime origin from env APP_BASE_URL / VERCEL_ENV + VERCEL_URL itself, else the config baseUrl; the one exception to core/lib.md closed_lib_env) and for checking a redirect target (sanitizeRedirectPath: keeps only a same-origin relative path, else the fallback) | entry @/lib/url
use: always
change: placement = src/config/lib/url.config.ts (baseUrl; upstream's config override copies the business url) | anything else → /order <direct parent>
rules:
using:
- redirect_from_input: a redirect target taken from input (query, form, state cookie) should pass sanitizeRedirectPath before the redirect (recommended, not enforced; a fork that wants to send users to an outside URL may do so)
read: none (no README; the entry's JSDoc: src/lib/url/sanitizeRedirectPath.ts, src/lib/url/getAppBaseUrl.ts)
