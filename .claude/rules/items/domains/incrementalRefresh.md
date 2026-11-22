---
paths:
  - "src/domains/core/incrementalRefresh/**"
---
# domains/incrementalRefresh
what: a factory for cron tasks that bring a read-model (snapshot table derived from source tables) up to date by diff within a time budget; entry createIncrementalRefresh from @/domains/incrementalRefresh/services/server
use: always
change: none → /order <direct parent>
rules:
using:
- recompute_idempotent: recompute is idempotent and always sets the read-model's trickle.orderByColumn (computed_at) to now()
- source_index: every source table has an (updated_at) index in the consumer domain's entities/drizzle.ts
- overlap_margin: overlapMarginMs is larger than the longest expected transaction
- budget_below_max: budgetMs = maxDuration − the longest chunk − start / cleanup slack (maxDuration 300s → 240_000)
- exclusion_outside: strict mutual exclusion, when needed, is added by the consumer outside the handler (e.g. pg_try_advisory_lock)
- hard_delete: physically deleted ids never turn dirty → recompute removes read-model rows whose id no longer exists (or trickle catches them)
- postgres_only: sources are Drizzle / Neon tables only, never Firestore
read: decide whether to use it → Overview | call it → API | wire a consumer → Usage | how phases and budget behave → Internals
