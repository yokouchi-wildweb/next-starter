# DOWNSTREAM NOTICE id:20261125-031520-expiry-receptacle
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:g2/20261124-161115/junction | commit:- (this commit)
date: 2026-11-25T03:15:20+09:00
severity: action-required
checkpoint: expiry-receptacle
change: (1) new add point expiryRules (src/lib/cron): item <domain>/plugs/expiryRules/<name>.ts = { table, key, rule: { kind: "expiresAt", column } | { kind: "age", column, days: number | () => number } | { kind: "rowDays", column, daysColumn }, where?, batchSize? = 1000, pii? } (type 3), delete only; a <name>.override.ts may set enabled and batchSize only (type 2); an item with pii: true whose override sets enabled: false stops pnpm generate extensions and check extensions; (2) one cron /api/cron/expiry-prune (daily 18:50 UTC): one runner (pg_try_advisory_xact_lock), items of closed domains dropped by the gate, items run oldest-swept first with one cronCheckpoint per item (an item cut by the budget runs first next time), rows deleted in FOR UPDATE SKIP LOCKED batches within runBudgetedBatches + createDeadline; with no item it returns skipped. No item is placed yet: today's prune crons are unchanged
why: vercel.json is your own file (type 5 self) and its crons are generated: the new cron must be generated into your version
required_actions:
1. `pnpm generate cron` (adds /api/cron/expiry-prune to your vercel.json crons; a repo without vercel.json skips this)
2. commit vercel.json apart from the merge
verify: `pnpm check cron` passes
manual_steps: -
refs: src/lib/cron/README.md; .claude/rules/items/lib/cron.md; .claude/rules/core/receptacles.md; src/lib/CATALOG.md
notes: key table: no key of CLAUDE.md / core / cards renamed or removed (card cron gains the expiryRules lines and pii_prune_kept; the CLAUDE.md ITEMS line comes with its own window order) | one more Vercel cron (counts toward a Hobby project's cron limit) | the next segments move today's prunes and rate_limits onto items, then retire the old crons
