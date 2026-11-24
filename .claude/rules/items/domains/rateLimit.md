---
paths:
  - "src/domains/core/rateLimit/**"
  - "src/config/domains/rateLimit.config.ts"
---
# domains/rateLimit
what: request limits counted per key { scope, identifier } with a rule (a category, or a fixed / sliding window with limit) and a weight, table rate_limits
- entry: the route Factory option `rateLimit: "<category>"` | consumeRateLimit / peekRateLimit (@/domains/core/rateLimit/services/server) | the category helpers checkRateLimit / getRateLimitStatus / cleanupExpiredRateLimits on top
use: always
change: counterpart → src/config/domains/rateLimit.config.ts (change values of upstream categories, add own categories declared in `Extra`, literal values)
rules:
using:
- rate_limit_on_route: a route is limited through its Factory `rateLimit: "<category>"` (or `rateLimitSubnet`) option (no extra wiring); checkRateLimit directly only for a non-IP identifier
- rate_limit_own_category: a fork's category is added only through its config values file with its name in `Extra` (unknown names fail the type check)
- rate_limit_user_identifier: a per-user limit takes the userId from the route's ctx.user, never from a session
- rate_limit_consume: a limit that is not a route's category (a weight, a sliding window, a non-IP key, the same transaction) → consumeRateLimit / peekRateLimit, never a hand-written counter on rate_limits or another table
- rate_limit_scope: a key's scope is a category name or "<district>.<name>" with your own district first (other forms throw)
- rate_limit_count: every function passes exactly limit requests per window (a category: maxRequests) | a request that would exceed it is refused and not counted
editing:
- rate_limit_one_statement: a fixed window counts in one atomic upsert, a sliding window sums its bucket rows in one transaction under a key xact advisory lock (services/server/store.ts) | no read-then-write
- rate_limit_type_param: the category type reaches lib/routeFactory only through its routeFactoryRateLimit item's type (CategoryOf in src/wiring/apiRoute.ts) (the lib never reads domains' types)
read: apply to a route, config values, consume / peek, identifiers → Usage | rule fields, consume / peek and the windows, helpers, 429 response, table → API | config values place → Extension | counting SQL, category type wiring → Internals | tests → Verification
