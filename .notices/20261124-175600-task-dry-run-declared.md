# DOWNSTREAM NOTICE id:20261124-175600-task-dry-run-declared
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261026-152333-shared-shelf.4r | commit:- (this commit)
date: 2026-11-24T08:56:00Z
severity: action-required
checkpoint: task-dry-run-declared
resolves: 20261124-172200-task-dry-run-writes
change: OneShotTask (@/lib/task) gains `dryRun?: true` = the task reads `--dry-run` itself and writes nothing then; `pnpm task <name> -- --dry-run` on a task without it, and on a cron task, is refused before any DB access (exit 2, the task named, no task_runs row); a git-ignored local migration (`*.local.ts`) must declare it (its real run needs a dry run first); upstream declares it on user:bulk-change-status, user:name-dedup, wallet:bulk-grant, wallet:lots-init-from-history, wallet:reverse-history, walletHistory:reason-key-backfill
why: the runner skipped only the stop keys under `--dry-run` and still called the task, so a task that ignores the flag (setting:merge-maintenance-keys) wrote for real while the operator believed nothing was written
required_actions:
1. Your own tasks and migrations that read `--dry-run`: find `git grep -l -e '--dry-run' -e 'dryRun' -- 'src/domains/*/scripts' ':!src/domains/core'` → add `dryRun: true,` to each `export const task` that really writes nothing under `--dry-run` (one that does not: leave it out; `--dry-run` is then refused)
2. A local migration `src/domains/**/scripts/migrations/*.local.ts` you keep: add `dryRun: true` (it fails to load without it)
verify: `pnpm typecheck` | `pnpm task <a task without dryRun> -- --dry-run` exits 2 with "試し走り(--dry-run)を持ちません" and writes no task_runs row | `pnpm test scripts/runner/task`
manual_steps: -
refs: src/lib/task/index.ts (OneShotTask dryRun) | src/lib/task/README.md (実行の記録, git に入れない移行) | scripts/runner/task/run.ts, execute.ts (dryRunRefusal) | order 20261124-172200-task-dry-run-writes
notes: no dry run (the runner refuses `--dry-run`, rehearse on a copy of the data instead): setting:merge-maintenance-keys, messaging:rename-template-vars, messaging:merge-dispatch-vars — the bodies of 20261119-195101-setting-code-values and 20261122-134000-messaging-records now say so | /ship's notice composition states for every `pnpm task` step whether the task has a dry run
