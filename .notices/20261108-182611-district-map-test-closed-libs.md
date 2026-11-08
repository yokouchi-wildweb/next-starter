# DOWNSTREAM NOTICE id:20261108-182611-district-map-test-closed-libs
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-08T18:26:11+09:00
severity: info
checkpoint: district-map-test-closed-libs
fixes: 20261108-172627-shared-shelf-lib-close-base
change: scripts/structure/district-map/districtMap.test.mjs no longer asserts that no district has config.ts or an override; it now checks that each district's config / override "exists" flag matches the file on disk, and that at least one closed lib (toast etc.) carries both
why: after shared-shelf-lib-close-base closed toast / frameDims with src/lib/<name>/config.ts and src/config/lib/<name>.config.ts, the old assertion failed, so pnpm test was red at that checkpoint
required_actions: none
verify: pnpm test scripts/structure/district-map (all pass)
manual_steps: -
refs: scripts/structure/district-map/districtMap.test.mjs, council 20261023-175358-config-redesign legate:l1 order:23
notes: test-only change, no runtime effect. Forks that edited this test take upstream's file as is.
