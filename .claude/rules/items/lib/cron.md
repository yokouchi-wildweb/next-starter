---
paths:
  - "src/lib/cron/**"
---
# lib/cron
what: the mechanism for scheduled tasks: one folder src/app/api/cron/<name>/ (task.ts + 1-line route.ts) read by the API route, `pnpm task` and the vercel.json generator, plus the time-budgeted batch runner | closed lib: entry "." @/lib/cron, entry "./node" @/lib/cron/node (task discovery with node:fs, for programs outside Next)
use: always
change: override = src/app/api/cron/<name>/task.override.ts (schedule, disabled; cronTasks in extensionPoints.ts)
rules:
using:
- cron_wiring (MANDATORY): 1 task = 1 folder src/app/api/cron/<name>/ (task.ts: UTC cron `schedule` + run → domain fn; 1-line route.ts; a fork retimes or turns it off with task.override.ts), no list file | vercel.json crons = `pnpm generate cron` output only (the Vercel build fails on a mismatch) | upstream add / remove / retime → notice
- budgeted_cron (MANDATORY): sweeps over unbounded-growth tables use runBudgetedBatches + createDeadline (@/lib/cron); read models refresh via createIncrementalRefresh (domains/incrementalRefresh)
- task_wiring_only: task.ts only wires which domain function runs when; the logic lives in domains/**/services/server, long ops notes in that domain's README
- run_dynamic_import: `run` imports its domain function dynamically (reading task.ts loads no DB)
- no_gate_in_task: task.ts never reads the feature gate; importing a closable domain's folder gates the task path automatically
- enabled_config_only: `enabled` is a sync check on config values only (never the DB), for conditions other than the feature
- wiring_in_task_only: in a cron folder task.ts may import any @/wiring, route.ts only @/wiring/cronRoute, task.override.ts none (src/wiring/wiring.test.mjs)
- no_double_work: a short-interval task never processes the same target twice (claim by conditional update or next-run time)
- cleanup_wording: never promise "removed right after expiry" for a cleanup task (hobby runs it once a day)
- oneshot_apart: one-shot tasks (backfill, migration) live in the domain's scripts/{tasks,migrations}/, never under src/app/api/cron/
- pii_prune_kept: a personal-data retention prune never uses `enabled`; its gate comes from its imports like any task (a closable domain's prune stops with the domain, whose tables are not created) | turn an always-open one off only when its domain is unused and its table empty
- regenerate_after_override: placing or changing task.override.ts is followed by pnpm generate cron -- --plan <hobby|pro>
editing:
- index_exports_all: index.ts exports every name the README and task files import from @/lib/cron
read: add a task → Usage | budgeted batches → Usage | override an upstream task → Extension | gate, enabled → Internals | checks → Verification | schedulers → Usage | auth → API
