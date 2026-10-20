# DOWNSTREAM NOTICE id:20261020-160342-cron-task-override
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-20T16:03:42+09:00
severity: info
checkpoint: cron-task-override
change: a fork can now retime or disable any upstream cron task without editing upstream files: put `src/app/api/cron/<name>/override.ts` exporting `cronOverride: CronTaskOverride = { schedule?: "<5-field UTC cron>", disabled?: true }` (type from "@/lib/cron"). schedule replaces task.ts's schedule in vercel.json and `pnpm task --due`; disabled: true leaves the task out of vercel.json and `--due` (manual `pnpm task <name>` still works). override.ts is fork-owned (CLAUDE.md CORE_FILES downstream_owned): upstream never creates it, so it never conflicts on merge. `pnpm test:cron-wiring` / `cron:check` reject an invalid schedule, unknown keys, and an override.ts left in a folder whose task.ts upstream removed. `pnpm task --list` shows `(override.ts)` / `[off: override.ts]`.
why: until now a fork could not drop or retime an upstream cron: editing vercel.json fails the Vercel build check, deleting the folder or editing upstream task.ts breaks merges.
required_actions: none. Optional: for each upstream task this fork wants on a different time or not at all, create its override.ts, then run `pnpm cron:generate --plan <hobby|pro>` and commit vercel.json.
verify: `pnpm test:cron-wiring` passes; if override.ts files were added, `pnpm cron:check` passes and `pnpm task --list` shows them.
manual_steps: -
refs: src/lib/cron/README.md (upstream のタスクを外す・時刻を変える), src/lib/cron/types.ts (CronTaskOverride), scripts/cron/discover.ts, CLAUDE.md CORE_FILES downstream_owned + FEATURES cron_wiring, upstream-request 20261020-154012-cron-minute-cadence-and-fixed-time (proposal 3)
notes: Do not disable the PII retention prunes (audit-log-prune, user-login-event-prune, device-fingerprint-prune, fingerprint-challenge-access-prune) unless the feature is unused and its table is empty — retention would stop being enforced. When upstream removes a task, delete your override.ts for it (the check names it). Apply after 20261020-155336-cron-task-folders-free-schedule.
