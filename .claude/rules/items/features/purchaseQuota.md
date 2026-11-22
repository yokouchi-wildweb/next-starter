---
paths:
  - "src/domains/core/purchaseQuota/**"
  - "src/config/domains/purchaseQuota.config.ts"
---
# domains/purchaseQuota
what: a per-user cap on the amount bought within a time window (ledger purchase_quota_ledger: reserved / committed / released), built into the purchase flow | entry @/domains/core/purchaseQuota/services/server/wrappers/purchaseQuotaHelper
use: payment
change: placement = src/config/domains/purchaseQuota.config.ts (`rules`; empty = off)
rules:
using:
- reserve_in_purchase_tx: reserveQuota always runs inside the caller's purchase tx (the ledger rolls back with it)
- settle_every_end: a purchase path commits on completion (commitQuota) and releases on fail, cancel or expiry (releaseQuota) | the base purchase flow already does both
- cleanup_not_scheduled: purchaseQuota:cleanup is a CLI task only | a fork that wants it scheduled adds its own task folder under src/app/api/cron/ (src/lib/cron)
editing:
- audit_exceeded_only: audit only the rejected reservation (purchase_quota.reservation.exceeded, bestEffort, outside the tx) | reserve / commit / release are never audited (high frequency)
- reserve_idempotent: a repeated reserve with the same purchaseRequestId overwrites the active row
- reserve_serialized: reserves of one user are serialized by pg_advisory_xact_lock(hashtext(userId))
read: rules config, scope → Extension | API, 429 response → API | flow, integration points, rateLimit difference → Internals | cleanup task → Usage
