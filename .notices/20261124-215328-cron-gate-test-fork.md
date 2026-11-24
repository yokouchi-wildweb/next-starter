# DOWNSTREAM NOTICE id:20261124-215328-cron-gate-test-fork
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261026-152333-shared-shelf.4r | commit:- (this commit)
date: 2026-11-24T21:53:28Z
severity: info
checkpoint: cron-gate-test-fork
resolves: 20261125-065033-cron-gate-test-fork-config
change: scripts/structure/cron/cronWiring.test.mjs「機能の門: 既定の判定は門番の gate.path」no longer fixes wallet as closed in a fork: Tier1 keeps the fixed "wallet"; a fork expects what the gate answers now (configPath of /api/cron/wallet-expire-lots from @/featureGate/node: closed → "wallet", open → null) for gateClosedBy and for the loaded task's closedBy
why: a fork that opened wallet in src/config/featureGate/switches.config.ts failed this test (closedBy null), which stopped its /ship --safe (oripa-do)
required_actions: none
verify: `pnpm test scripts/structure/cron/cronWiring.test.mjs` passes with wallet open or closed
manual_steps: -
refs: scripts/structure/cron/cronWiring.test.mjs | scripts/structure/cron/discover.ts (gateClosedBy) | order 20261125-065033-cron-gate-test-fork-config
notes: no fork action; the test's meaning (a closed rule gives closedBy = the rule name, the loader carries it) is kept
