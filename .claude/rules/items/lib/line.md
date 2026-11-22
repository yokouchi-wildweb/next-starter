---
paths:
  - "src/lib/line/**"
---
# lib/line
what: LINE integration for signed-in users: OAuth linking (the LINE userId is stored in user_line_profiles), Messaging API push / reply / multicast / broadcast, webhook parsing and signature check | entry @/lib/line, domain domains/core/userLineProfile
use: userLineProfile
change: none → /order <direct parent> | values = env LINE_LOGIN_*, LINE_MESSAGING_*, LIFF_ID
rules:
using:
- link_not_login: LINE links an account to a signed-in user; it is never the sign-in provider (Firebase Auth stays)
- no_profile_image: never store the LINE profile image (no URL, no file)
- state_helpers: a fork's own LINE login flow calls issueOAuthState / verifyOAuthState, never copies the nonce / state code | another flow uses another cookieName | the caller deletes the cookie after the check | on failure ignore the redirect target and go to "/"
- retry_key_stable: a resend reuses lineRetryKey(<a value stable across resends, e.g. the delivery id>) within 24 hours
- webhook_handler_items: per-event work goes to <domain>/plugs/userLineProfileWebhookHandlers/<name>.ts (pnpm generate extensions) | the webhook route is never edited
editing:
- verify_api: id_token is verified by LINE's Verify API, never decoded locally
- signed_webhook: the webhook checks x-line-signature (HMAC-SHA256) before any handler
read: setup, link button, unlink, push, webhook, flex → Usage | routes, service, library exports, state helpers → API | security, notes → Internals
