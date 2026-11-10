# DOWNSTREAM NOTICE id:20261110-100112-tier1-only-test-assertions
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:quest/outrider | commit:- (this commit)
date: 2026-11-10T10:01:12+09:00
severity: info
checkpoint: tier1-only-test-assertions
resolves: 20261108-165447-tier1-only-test-assertions-in-forks
change: 5 upstream tests no longer assume Tier1's own values in a fork: AdminFrame.test.tsx (empty frame table = Tier1 only), eslint-rules/import-boundaries.test.mjs (link-via-shelf: error in Tier1, warn in a fork), scripts/structure/role/tests/checks.test.mjs (role list order = Tier1 only, core role values everywhere), scripts/runner/guard/guard.test.ts (the --confirm=production half skips when the realtime room deploy would run), adminBankTransferReviewBulkActions.test.tsx (sendEmail with order 100 everywhere, "only sendEmail" = Tier1 only)
why: these failed in forks that follow the rules (fork frame.ts declarations, warn severity downstream, the fork's own enum user_role order, room enabled, fork bulk-action items); Tier1 still asserts what it asserted before
required_actions: none
verify: pnpm test src/app/admin/_layout/AdminFrame.test.tsx eslint-rules/import-boundaries.test.mjs scripts/structure/role/tests/checks.test.mjs scripts/runner/guard/guard.test.ts src/features/core/bankTransferReview/hooks/adminBankTransferReviewBulkActions.test.tsx passes (a fork sees skips with a printed reason)
manual_steps: -
refs: src/lib/forkOwnership/forkIds.mjs (readForkIdentity().isTier1), precedent notice 20261106-191458-analytics-consent-test-tier1-defaults, order 20261108-165447-tier1-only-test-assertions-in-forks
notes: if the fork patched any of these 5 tests locally to make them pass, take upstream's version
