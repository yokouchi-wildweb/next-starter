# DOWNSTREAM NOTICE id:20261121-204228-test-file-limit-after-done
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261106-194813-tooling-ownership-and-growth.2 | commit:(this commit)
date: 2026-11-21T20:42:28+09:00
severity: info
checkpoint: test-file-limit-after-done
fixes: 20261119-092123-test-no-force-exit
pick: -
resolves: 20261121-044322-test-file-limit-under-load
change: pnpm test's per-file time limit (TEST_FILE_TIMEOUT / --file-timeout, default 120 s) now counts the time a test file's process stays up after all its tests ended (node:test root after), not the wall time from its start. A file that is only slow under load (a whole run in parallel) no longer fails; a file that never exits (a handle or timer left) still fails by name: `test: 時間切れ <秒> 秒(テストの後): <file>`. A file stuck before its tests start (module loading) fails at 10× the limit from its start: `時間切れ <秒> 秒(起動から)`. A test stuck mid-way is still the per-test limit's (--test-timeout, 60 s)
why: in a whole pnpm test on a loaded machine the wall-clock limit failed files that pass alone (closed.test 195 s, libPackage.test 199 s; 48 s alone) — the limit was meant for files that never exit (order 20261121-044322-test-file-limit-under-load)
required_actions: none
verify: `pnpm test scripts/runner/test/testEntry.test.mjs` passes | a whole `pnpm test` prints no 時間切れ line for files that pass alone
manual_steps: -
refs: scripts/runner/preload/fileTimeout.mjs | scripts/runner/test/README.md (時間の上限) | notice 20261119-092123-test-no-force-exit (introduced the limit)
notes: forks that raised TEST_FILE_TIMEOUT / --file-timeout only because of load may drop it. Its meaning is now the time after the tests, so the same number is a looser limit than before
