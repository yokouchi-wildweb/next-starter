# DOWNSTREAM NOTICE id:20261119-092123-test-no-force-exit
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261106-194813-tooling-ownership-and-growth.2 | commit:- (this commit)
date: 2026-11-19T09:21:23+09:00
severity: action-required
checkpoint: test-full-report
fixes: 20261117-181158-test-force-exit
pick: clean
change: pnpm test no longer passes --test-force-exit (scripts/runner/test/run.mjs BASE_ARGS); a test file now ends on its own, and one that leaves an open handle fails by name at the per-file limit (default 120s)
why: force-exit ended each test file's process before its report reached the parent, so the tail of a file's results vanished, counted neither pass nor fail with the exit unchanged (a failing test there was hidden); measured on one tree: 4156-4195 tests per run with it, 4219 every run without
required_actions:
1. run `pnpm test`; when it prints `test: 時間切れ 120 秒: <file>`, fix that test file so its process exits: mock the real network call (e.g. an SWR + axios hook, as src/features/core/messaging/hooks/useInboxUnreadModal.test.tsx mocks useInboxItemDetail), close servers, clear timers; never re-add --test-force-exit and raise TEST_FILE_TIMEOUT / --file-timeout only to investigate | no such line → nothing to do
verify: `pnpm test scripts/runner/test` passes; `pnpm test` run twice gives the same test count and prints no `時間切れ` line
manual_steps: -
refs: scripts/runner/test/run.mjs, scripts/runner/test/README.md (終わり方), scripts/runner/test/testEntry.test.mjs, scripts/runner/preload/fileTimeout.mjs
notes: the test count of a run may rise after taking this (results that were silently lost now appear; some of them may fail and were hidden before)
