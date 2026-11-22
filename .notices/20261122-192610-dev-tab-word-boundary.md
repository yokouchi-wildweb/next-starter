# DOWNSTREAM NOTICE id:20261122-192610-dev-tab-word-boundary
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:qc/kagerou/o/20261122-190308-quest-dev-tab-vite-word-boundary | commit:(this commit)
date: 2026-11-22T19:26:10+09:00
severity: info
checkpoint: dev-tab-word-boundary
resolves: 20261121-203433-dev-tab-vite-word-boundary
change: dev-tab's outside-dev-server detection (DEV_COMMAND_PATTERN in scripts/workflow/dev-tab/lib.ts) now requires a word boundary around each word, so `vite` no longer matches `invite` (a caller's shell line holding a path like /mypage/invite was taken for a running dev server and dev-tab exited 3 without starting)
why: info only; the tool fix arrives with the merge
required_actions: none
verify: pnpm test scripts/workflow/dev-tab/dev-tab.test.ts
manual_steps: -
refs: scripts/workflow/dev-tab/lib.ts, scripts/workflow/dev-tab/dev-tab.test.ts, order 20261122-190308-quest-dev-tab-vite-word-boundary
notes: -
