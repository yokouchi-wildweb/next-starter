# DOWNSTREAM NOTICE id:20261117-173914-test-file-time-limit
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-17T17:39:14+09:00
severity: info
checkpoint: test-file-time-limit
change: pnpm test now gives every test file a time limit (default 120s): a file that does not exit within it fails by name (stderr line "test: 時間切れ <s> 秒: <file>", listed under failing tests) and the run goes on
why: a test file that keeps a handle open after its tests (e.g. after a failed assertion) used to hang the whole pnpm test silently (/ship --safe, /flux, guild whole-test runs)
required_actions: none
verify: pnpm test scripts/runner/test passes
manual_steps: -
refs: scripts/runner/preload/fileTimeout.mjs, scripts/runner/test/run.mjs, scripts/runner/test/README.md (時間の上限)
notes: a fork test file that legitimately runs longer than 120s now fails with the timeout line; raise the limit with `pnpm test --file-timeout=<seconds>` or env TEST_FILE_TIMEOUT=<seconds> (0 = no limit), or split the file. A file that times out after its tests usually leaks a handle (interval, server, DB pool): close it in after(). The limit cannot stop a synchronous infinite loop.
