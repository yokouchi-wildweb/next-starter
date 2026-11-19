---
paths:
  - "src/lib/url/**"
---
# lib/url
what: the closed lib for this app's own origin (getAppBaseUrl: APP_BASE_URL, else the config baseUrl) and for checking a redirect target (sanitizeRedirectPath: keeps only a same-origin relative path, else the fallback) | entry @/lib/url
use: always
change: placement = src/config/lib/url.config.ts (baseUrl; upstream's override copies the business url) | anything else → /order <direct parent>
rules:
using:
- redirect_from_input: a redirect target taken from input (query, form, state cookie) should pass sanitizeRedirectPath before the redirect (recommended, not enforced; a fork that wants to send users to an outside URL may do so)
read: no README: the JSDoc of src/lib/url/sanitizeRedirectPath.ts and src/lib/url/getAppBaseUrl.ts
