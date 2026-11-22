---
paths:
  - "src/domains/core/rateLimit/**"
  - "src/config/domains/rateLimit.config.ts"
---
# domains/rateLimit
what: request limits per identifier (IP by default) and category (window seconds + max requests), table rate_limits | entry: the route Factory option `rateLimit: "<category>"`, helpers checkRateLimit / getRateLimitStatus / cleanupExpiredRateLimits (services/server/wrappers/rateLimitHelper.ts)
use: always
change: overlay → src/config/domains/rateLimit.config.ts (change values of upstream categories, add own categories declared in `Extra`, literal values)
rules:
using:
- rate_limit_on_route: a route is limited through its Factory `rateLimit: "<category>"` (or `rateLimitSubnet`) option (no extra wiring); checkRateLimit directly only for a non-IP identifier
- rate_limit_own_category: a fork's category is added only through the override with its name in `Extra` (unknown names fail the type check)
- rate_limit_user_identifier: a per-user limit takes the userId from the route's ctx.user, never from a session
editing:
- rate_limit_type_param: the category type reaches lib/routeFactory only as a type parameter from src/wiring/apiRoute.ts (the lib never reads features types)
read: apply to a route, override, identifiers → Usage | rule fields, helpers, 429 response, table → API | override place → Extension | category type wiring → Internals
