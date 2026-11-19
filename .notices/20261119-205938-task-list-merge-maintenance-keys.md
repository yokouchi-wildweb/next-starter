# DOWNSTREAM NOTICE id:20261119-205938-task-list-merge-maintenance-keys
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:(this commit)
date: 2026-11-19T20:59:38+09:00
severity: info
checkpoint: task-list-merge-maintenance-keys
fixes: 20261119-195101-setting-code-values
change: the upstream task list in scripts/structure/extensions/upstreamItems.test.mts now includes the migration setting:merge-maintenance-keys (13 upstream tasks)
why: the checkpoint setting-code-values added that migration but not its line in the fixed list, so pnpm test fails at that checkpoint ("タスクの走査: 上流のドメインのタスク・移行")
required_actions: none
verify: `pnpm test scripts/structure/extensions/upstreamItems.test.mts` passes
manual_steps: -
refs: scripts/structure/extensions/upstreamItems.test.mts | .notices/20261119-195101-setting-code-values.md
notes: test-only fix; no app behavior changes. A later cleanup commit deletes the migration and drops this line again once upstream has run it on its own DBs.
