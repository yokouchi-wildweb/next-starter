# DOWNSTREAM NOTICE id:20261126-135716-setting-migration-exit
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:8db148815
date: 2026-11-26T13:57:16+09:00
severity: info
checkpoint: setting-migration-exit
change: `pnpm task setting:merge-maintenance-keys` and `pnpm task setting:copy-list-per-page` end as a rerunnable failure (TaskRerunnableError: exit 1, run record failed, no stop key taken) when the check after the write does not hold: merge = old keys still on some row (`remaining` > 0); copy = rows still without `adminListPerPage` (`missing` > 0). copy-list-per-page's result keys: `mismatched` → `missing` (rows it could not copy) and `kept` (rows that kept an already saved value, not a failure)
why: src/lib/task/README.md: an idempotent task that finds its own check failing throws TaskRerunnableError, so it can be run again
required_actions: none
verify: -
manual_steps: -
refs: src/domains/core/setting/scripts/migrations/merge-maintenance-keys.ts, copy-list-per-page.ts, src/domains/core/setting/README.md
notes: A fork that already ran them keeps its succeeded record. The step of notice 20261031-141531-setting-fields-core-ui "confirm `mismatched: 0`" now reads: the task succeeds (exit 0).
