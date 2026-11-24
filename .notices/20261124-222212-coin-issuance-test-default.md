# DOWNSTREAM NOTICE id:20261124-222212-coin-issuance-test-default
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261026-152333-shared-shelf.4r | commit:- (this commit)
date: 2026-11-24T13:22:12Z
severity: info
checkpoint: coin-issuance-test-default
resolves: 20261124-222500-coin-issuance-test-reads-fork-config
change: src/domains/core/analytics/services/server/coinIssuance/coinIssuance.test.ts checks the upstream defaults (issuanceReasonCategories = ["bonus"], coinIssuanceWalletTypes = ["regular_coin"]) from the owner's defaults analyticsConfigDef.defaults instead of the fork-resolved analyticsConfig, and that issuanceReasonCategories() with no argument returns the resolved value; no behavior change
why: a fork that sets its own value in src/config/domains/analytics.config.ts (e.g. ["bonus", "other"]) failed pnpm test, so it could not make a safe point
required_actions: none
verify: `pnpm test src/domains/core/analytics/services/server/coinIssuance/coinIssuance.test.ts` passes with your own analytics values
manual_steps: -
refs: src/domains/core/analytics/config.ts (analyticsConfigDef) | order 20261124-222500-coin-issuance-test-reads-fork-config
notes: no fork-side test edit | same class as 20261124-192657-tier1-tests-fork-additions (Tier1 tests that read a fork's values or items)
