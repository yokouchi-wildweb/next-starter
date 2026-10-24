# DOWNSTREAM NOTICE id:20261024-154302-server-only-stub-module-mocks
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-24T15:43:02+09:00
severity: info
checkpoint: server-only-stub-module-mocks
moved: src/features/core/storageObject/callsites.test.ts -> src/features/core/storageObject/callsites.test.mts
change: scripts/test/serverOnlyStub.mjs now also wraps Module._resolveFilename, so `server-only` resolves to the empty stub under --experimental-test-module-mocks too (before: "Cannot find module 'server-only'", e.g. pnpm test:auth-session-refresh). The `task` script preloads the same stub, and scripts/tasks/run.ts loads the env file (APP_ENV, default .env.development; existing env vars win, a missing file is fine), so `pnpm task <name>` works for tasks that reach `import "server-only"` code (e.g. storage-sweep). New regression test `pnpm test:server-only-stub`. callsites.test.ts → .mts: it now runs the real core check functions (isChatParticipant / isOwnPendingPurchaseRequest) and mocks only their data sources.
why: Every fresh clone failed module-mock tests and server-only tasks. Some checkouts worked around it with a hand-placed node_modules/server-only stub, which is no longer needed and hides the real resolution path.
required_actions:
1. Merge upstream. If package.json `test:storage-object` or `task` conflicts, take upstream's version and re-add only the fork's own additions.
2. If the fork has a hand-placed `node_modules/server-only` (check with `ls node_modules/server-only`), delete it: `rm -r node_modules/server-only`. It is not a dependency; reinstalling with `pnpm install` also removes it.
3. If the fork has its own `npx tsx ... scripts/tasks/run.ts` invocations or a workaround such as `npx tsx --env-file=... --import ./scripts/test/serverOnlyStub.mjs scripts/tasks/run.ts`, replace it with `pnpm task <name>`.
verify: `pnpm test:server-only-stub` passes (it also fails if node_modules/server-only exists) | `pnpm test:auth-session-refresh` and `pnpm test:storage-object` pass | `pnpm task --list` prints the task list
manual_steps: -
refs: scripts/test/serverOnlyStub.mjs, scripts/test/serverOnlyStub.test.mts, scripts/tasks/run.ts, package.json (task, test:server-only-stub, test:storage-object), scripts/README.md (定期タスク / テスト)
notes: Fork-specific impact: not checked.
