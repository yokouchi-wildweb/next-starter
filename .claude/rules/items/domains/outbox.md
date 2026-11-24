---
paths:
  - "src/domains/core/outbox/**"
  - "src/config/domains/outbox.config.ts"
---
# domains/outbox
what: the outbox: a durable external side effect (provider sync, a delivery notice) is written as one row in the same transaction as the DB update (enqueueOutbox / withOutbox, @/domains/outbox/services/server), pushed once after commit (kickOutbox) and guaranteed by the budgeted cron outbox-dispatch
use: outbox (no paths, default off; a feature that uses it lists core/outbox or dependsOn outbox)
change: add = <domain or lib>/plugs/outboxHandlers/<name>.ts (export const handler) | override = <name>.override.ts beside an upstream handler (maxAttempts, backoff only) | counterpart = src/config/domains/outbox.config.ts (retry defaults, dispatch budget, monitoring thresholds)
rules:
using:
- outbox_entry (MANDATORY): a durable external side effect of a DB update → enqueueOutbox(tx, …) in that transaction (or withOutbox), never a call to the provider inside the transaction and never a bare after() without a row
- outbox_payload: payload = JSON with a numeric version field v, ids only, never secrets (keys, tokens, passwords) | the handler reads the rest at handle time
- outbox_idempotent: delivery is at least once and unordered → handle is idempotent (ctx.id as the provider's idempotency key) | failure = throw; the outbox retries with exponential backoff and quarantines at maxAttempts (rows are kept)
- outbox_kind: kind = "<district that placed the handler>.<action>" as a literal, unique across the repo (pnpm generate extensions stops otherwise)
- outbox_held: a handler whose domain is closed, or an unconfigured base (BackendNotConfiguredError), holds the row without counting an attempt | a kind with no handler stays pending and is reported, never failed
- outbox_reprocess: quarantined rows go back only through `pnpm task outbox:reprocess -- --kind <kind> | --id <id> | --all`, never by hand-written SQL
editing:
- outbox_one_entry: every row is processed through processOutboxRow / processClaimedRow (kick and cron alike) | retry, quarantine and hold live there only
- outbox_cron_shape: the cron holds one runner with pg_try_advisory_xact_lock in an outer transaction that holds no row locks, claims with FOR UPDATE SKIP LOCKED in batches, runs inside runBudgetedBatches + createDeadline and skips in maintenance
- outbox_no_messaging: the outbox never absorbs messaging's internal events (message_events)
- outbox_report_passed_in: the threshold report goes through the report function task.ts passes in (@/wiring/serverErrorReport); the domain never imports @/wiring
read: enqueue, push, handlers → Usage | functions, results, table → API | override, thresholds, opening → Extension | cron, lock, held, monitoring → Internals | tests → Verification
