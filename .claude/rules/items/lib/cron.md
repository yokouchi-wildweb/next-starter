---
paths:
  - "src/lib/cron/**"
  - "src/**/plugs/{cronMaintenance,expiryRules}/**"
---
# lib/cron
what: the mechanism for scheduled tasks: one folder src/app/api/cron/<name>/ (task.ts + 1-line route.ts) read by the API route, `pnpm task` and the vercel.json generator, the time-budgeted batch runner, and the one expiry prune (point expiryRules, cron expiry-prune)
- closed lib: entry "." @/lib/cron, "./node" @/lib/cron/node (task discovery with node:fs, for programs outside Next), "./server" @/lib/cron/server (the expiry store, DB), "./points" (item types)
use: always
change: override = src/app/api/cron/<name>/task.override.ts (schedule, disabled; cronTasks in extensionPoints.ts) | add = <domain or lib>/plugs/expiryRules/<name>.ts (export const rule) | override = <name>.override.ts beside an upstream expiry item (enabled, batchSize only)
rules:
using:
- cron_wiring (MANDATORY): 1 task = 1 folder src/app/api/cron/<name>/ (task.ts: UTC cron `schedule` + run → domain fn; 1-line route.ts; a fork retimes or turns it off with task.override.ts), no list file | vercel.json crons = `pnpm generate cron` output only (the Vercel build fails on a mismatch) | upstream add / remove / retime → notice
  - vercel.json itself is type 5 self: each repo that deploys to Vercel commits its own (other keys hand-written), a take-in conflict keeps its version then pnpm generate cron (core/design.md self_files)
- vercel_plan: the plan = repo.json vercel.plan (pnpm workflow repo-json set vercel.plan <hobby|pro>, the Vercel contract) | pnpm check cron passes only that plan's crons, the other plan's output fails
  - missing key: the check passes either plan with a warning, pnpm generate cron reads the plan from the current crons (inferCronPlan) and warns | no key and no vercel.json = not on Vercel, skipped
  - an /api/cron/ path is never in both crons and schedules (it would run twice; the check fails)
- budgeted_cron (MANDATORY): sweeps over unbounded-growth tables use runBudgetedBatches + createDeadline (@/lib/cron); read models refresh via createIncrementalRefresh (domains/incrementalRefresh)
- task_wiring_only: task.ts only wires which domain function runs when; the logic lives in domains/**/services/server, long ops notes in that domain's README
- run_dynamic_import: `run` imports its domain function dynamically (reading task.ts loads no DB)
- no_gate_in_task: task.ts never reads the feature gate; importing a closable domain's folder gates the task path automatically
- enabled_config_only: `enabled` is a sync check on config values only (never the DB), for conditions other than the feature
- wiring_in_task_only: in a cron folder task.ts may import any @/wiring, route.ts only @/wiring/cronRoute, task.override.ts none (src/wiring/wiring.test.mjs)
- no_double_work: a short-interval task never processes the same target twice (claim by conditional update or next-run time)
- cleanup_wording: never promise "removed right after expiry" for a cleanup task (hobby runs it once a day)
- oneshot_apart: one-shot tasks (backfill, migration) live in the domain's scripts/{tasks,migrations}/, never under src/app/api/cron/
- pii_prune_kept: an expiryRules item with `pii: true` refuses a fork override `enabled: false` (pnpm generate extensions and the extensions check stop) | its gate comes from the domain that plugs it (a closable domain's prune stops with the domain, whose tables are not created)
- expiry_rules: a delete of rows past their time (expiresAt / age / rowDays, where? to narrow) = one expiryRules item run by the one cron expiry-prune, never its own cron folder | table, key and columns are literal names | upstream example: domains/core/wallet/plugs/expiryRules/walletLotsPrune.ts (age + where)
  - how it deletes: the direct DELETE by default | or the item passes remove(keys, ctx) = the owner domain's public delete (audit, files, events) per key; the lib never reads a domain
  - remove: rows are picked without row locks in small batches (default 50, 1-1000) | idempotent per row (a row already gone counts as removed) | re-check ctx.condition in the owner's TX before deleting | return failed keys, never throw for one row (they are recorded and picked again next run)
  - another domain's table: an item that deletes rows of a table its own domain does not own passes remove calling that owner's public service (a rule, no check)
- regenerate_after_override: placing or changing task.override.ts is followed by pnpm generate cron (plan = repo.json vercel.plan, or -- --plan <hobby|pro>; vercel_plan)
- maintenance_pass_only: scheduled runs skip during maintenance (the cronMaintenance item, upstream from setting; empty = never) | `maintenance: "pass"` in task.ts only for a task whose skip loses data | an upstream task a fork must keep running → disable it in task.override.ts + its own task folder with pass (task.override.ts has no maintenance key)
editing:
- index_exports_all: index.ts exports every name the README and task files import from @/lib/cron
read: add a task → Usage | budgeted batches → Usage | expiry items → Usage | expiry functions → API | expiry overrides → Extension | expiry runner → Internals | override an upstream task → Extension | gate, enabled → Internals | checks → Verification | schedulers → Usage | auth → API
