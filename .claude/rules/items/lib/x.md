---
paths:
  - "src/lib/x/**"
---
# lib/x
what: the X (Twitter) API base over twitter-api-v2: clients (OAuth 1.0a / 2.0 / app-only), OAuth 2.0 PKCE, tweet and media helpers, error classes, webhook verification | entry @/lib/x | stored user tokens: userXProfile domain
use: always
change: none → /order <direct parent>
rules:
using:
- x_user_client: acting as a linked user goes through userXProfileService.getValidClient (refresh and storage handled) | tokens are stored only encrypted (src/lib/crypto) through that service
- x_no_profile_image: the X profile image is never fetched or stored (no login provider's image is kept)
- x_media_oauth1: media upload needs an OAuth 1.0a client | an OAuth 2.0 client cannot upload
- x_webhook_verified: a webhook POST is read through parseXWebhookRequest (signature checked) | GET answers the CRC with handleCrcChallenge
- x_env_secrets: credentials and the encryption key come from env only, never hard-coded
- x_direct_v2: what the helpers lack is called on the client's twitter-api-v2 API directly, not by a new wrapper
editing:
- x_no_rewrap: the lib never re-wraps the whole twitter-api-v2 API | auth and config stay unified here
- x_timing_safe: the webhook signature comparison stays timing-safe (HMAC-SHA256 + timingSafeEqual)
read: setup, posting, OAuth, linking, errors, webhook → Usage | functions, service, error codes, routes, table → API | security, limits → Internals | crypto, twitter-api-v2, pricing → Related
