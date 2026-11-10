# DOWNSTREAM NOTICE id:20261110-101020-gate-client-test-fork-menu
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:quest/outrider | commit:- (this commit)
date: 2026-11-10T10:10:20+09:00
severity: info
checkpoint: gate-client-test-fork-menu
resolves: 20261108-092937-gate-client-test-fork-menu
change: tests that assumed upstream's admin menu now run on Tier1 only (skip with a printed reason in a fork): src/featureGate/checks/readers.test.tsx (sample row / 「リクエスト管理」 sidebar tests), src/features/core/admin/menu/upstreamMenu.test.ts (3 tests), src/features/core/admin/hooks/useAdminMenu.test.tsx (3 tests). readers.test.tsx gains a fixture-menu test (closing sampleDomain drops its rows and the emptied category, keeps a category with other rows) that runs on every tier
why: a fork's admin menu (its categories, items and overrides) is the fork's own, so these tests failed forever in forks; the per-rule sidebar test (no closed href, no empty category) still runs on the fork's real menu
required_actions: none
verify: pnpm test src/featureGate/checks/readers.test.tsx src/features/core/admin passes (a fork sees 8 skips with a printed reason)
manual_steps: -
refs: src/lib/forkOwnership/forkIds.mjs (readForkIdentity().isTier1), src/features/core/admin/menu/buildAdminMenu.test.ts (mechanism on fixtures), order 20261108-092937-gate-client-test-fork-menu
notes: if the fork patched any of these 3 tests locally to make them pass, take upstream's version
