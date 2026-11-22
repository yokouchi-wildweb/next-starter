---
paths:
  - "src/domains/core/userCounter/**"
  - "src/config/domains/userCounter.config.ts"
---
# domains/userCounter
what: per-user atomic counters (user × key, lifetime + daily), the source of truth for "how many times did this user …"; entry @/domains/userCounter/services/server/counterService (server only)
use: userCounter
change: placement → src/config/domains/userCounter.config.ts
rules:
using:
- uc_gate: another domain that counts checks gate.enabled("userCounter") or declares requires (the feature-gate dependency check)
- uc_server_only: bump / bumpDaily run on the server only, after the server has validated the event; never exposed to a client
- uc_key_owner: the consuming domain names its counter_key, namespaced (e.g. `secret_shop.dialog.<id>`)
- uc_not_visits: "did / how many days did this user visit", DAU, active days → analytics DAU (user_daily_activities), never a new userCounter key
- uc_user_read: a user-facing read = the domain's own createMeRoute reading counters on the server and returning its own shape; the key scheme never leaves the server
- uc_strict_limit: a daily limit that must never be passed (billing etc.) checks the dailyCount bumpDaily returns and rolls back the tx when over
editing:
- uc_admin_api: the generic API /api/userCounter/** stays admin only; no user read endpoint here
read: which counting primitive → Overview | bump, limits, user reads → Usage | functions, tables, daily rows → API | milestone → Internals
