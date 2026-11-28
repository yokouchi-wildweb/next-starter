# DOWNSTREAM NOTICE id:20261128-103530-districtmap-cache-key-test
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:qc/kagerou/o/20261128-103401-districtmap-overridekeys-test | commit:(this commit)
date: 2026-11-28T10:35:30+09:00
severity: info
checkpoint: districtmap-cache-key-test
fixes: 20261127-093259-decl-rules-match
pick: clean
change: src/lib/districtMap/declarations.test.mjs expects the entities point's override keys ["apiAccess", "cache"] (cache was added to its overrideOf in 10632c3ab, D353, and the test still pinned ["apiAccess"]); test only, no code change
why: info only; the test failed on upstream main and in every fork that took 20261127-093259-decl-rules-match (pnpm test and /sluice --safe stopped, no safe point); the merge brings the fixed test
required_actions: none
verify: pnpm test src/lib/districtMap
manual_steps: -
refs: src/lib/districtMap/declarations.test.mjs, src/lib/domain/extensionPoints.ts (entities overrideOf), commit 10632c3ab, order 20261128-103401-districtmap-overridekeys-test
notes: reported by railroad Polaris line (boardgame-site); a fork that edited this test locally to pass may return it to upstream's text
