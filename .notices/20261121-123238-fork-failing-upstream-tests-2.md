# DOWNSTREAM NOTICE id:20261121-123238-fork-failing-upstream-tests-2
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:(this commit)
date: 2026-11-21T12:32:38+09:00
severity: info
checkpoint: fork-failing-upstream-tests-2
fixes: 20261110-100112-tier1-only-test-assertions, 20261110-135737-shared-shelf-frame-guard-fixes, 20261110-153334-mypage-menu-items, 20261119-092123-test-no-force-exit
pick: -
resolves: 20261111-084825-who-test-tier1-only, 20261111-092505-link-via-shelf-test-fork, 20261111-095332-mypage-menu-test-fork, 20261121-044321-fork-failing-upstream-tests-menu-cookie, 20261118-100644-fork-failing-upstream-tests
change: upstream tests that failed by construction in every fork now pass there: who.test "このリポ(Tier1、HEAD の木)の代表のパス" and both upstreamMenu tests (admin, mypage) run in Tier1 only; the link-via-shelf config test lints a sample with a closable path (/wallet) so closableOnly reports it; accountItems' default-list assert compares with the loaded config; cookieSecure passes a place that only hands an ISSUERS tool's cookie (issueOAuthState's nonceCookie from @/lib/line) to cookies.set
why: the tests are upstream-owned; a fork that only adds receptacle items / config values / an OAuth route through issueOAuthState got red on them and had to skip-read failures that are not its own
required_actions: none
verify: pnpm test src/lib/forkOwnership/who.test.mjs eslint-rules/import-boundaries.test.mjs src/features/core/admin/menu/upstreamMenu.test.ts src/features/core/user src/lib/appEnv/cookieSecure.test.mjs — all pass (the Tier1-only cases show as skipped in a fork)
manual_steps: -
refs: src/lib/appEnv/cookieSecure.test.mjs ISSUERS | src/lib/appEnv/README.md cookie の secure の形 | .claude/rules/items/lib/appEnv.md app_env_cookie_secure
notes: a fork route that sets issueOAuthState's nonceCookie needs no entry anywhere; a fork cookie writer of its own still carries `secure: !isDevelopment()` | the upstream line/login route left COOKIE_WRITERS (covered by ISSUERS) | a temporary permit citing one of the resolved orders expires with this notice
