# DOWNSTREAM NOTICE id:20261110-101356-analytics-exclusion-test-fork-items
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:quest/outrider | commit:- (this commit)
date: 2026-11-10T10:13:56+09:00
severity: info
checkpoint: analytics-exclusion-test-fork-items
resolves: 20261108-101254-analytics-exclusion-test-fork-items
change: src/features/core/analytics/services/server/exclusion/exclusion.test.ts checks "no items, no extra conditions" with an injected empty providers list on every tier; the case on the generated exclusionProviders list (empty only upstream) runs on Tier1 only and skips with a printed reason in a fork
why: a fork that adds an item to src/features/core/analytics/exclusionProviders/ (as notice 20261105-115033-analytics-exclusion-providers tells it to) failed this case forever
required_actions: none
verify: pnpm test src/features/core/analytics/services/server/exclusion/exclusion.test.ts passes (a fork sees 1 skip with a printed reason)
manual_steps: -
refs: src/features/core/analytics/services/server/utils/userFilter.ts (buildExclusionConditions providers argument), order 20261108-101254-analytics-exclusion-test-fork-items
notes: if the fork patched this test locally to make it pass, take upstream's version
