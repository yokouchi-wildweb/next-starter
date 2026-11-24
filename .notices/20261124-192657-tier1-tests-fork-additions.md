# DOWNSTREAM NOTICE id:20261124-192657-tier1-tests-fork-additions
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261026-152333-shared-shelf.4r | commit:- (this commit)
date: 2026-11-24T10:26:57Z
severity: info
checkpoint: tier1-tests-fork-additions
resolves: 20261124-192410-tier1-tests-fork-additions
change: four Tier1 tests that count a closed set check it exactly only in Tier1 (readForkIdentity isTier1); in a fork they check that every upstream item is there and that the extras sit in the declared place: scripts/structure/district-map/districtMap.test.mjs (receptacles outside districts: the upstream 2 + src/app/**/_components), src/domains/core/coupon/lib/adminSectionTabs.test.ts (core 3 tabs first), src/domains/core/userGroup/plugs/userGroupCriteria/criteria.test.ts (the upstream 5 criteria), src/lib/formSuite/a11yContract.test.tsx (every table unit exists in src/components/Input)
why: a fork's own items added through the declared points (a route's _components/extensionPoints.ts, coupon adminSectionTabs plugs, userGroupCriteria plugs, a new unit on the src/components/Input shelf) failed these tests, so pnpm test failed in the fork and no safe point could be made
required_actions: none
verify: `pnpm test scripts/structure/district-map/districtMap.test.mjs src/domains/core/coupon/lib/adminSectionTabs.test.ts src/domains/core/userGroup/plugs/userGroupCriteria/criteria.test.ts src/lib/formSuite/a11yContract.test.tsx` passes with your own additions in place | `pnpm workflow notices safePoint check` gets past pnpm test
manual_steps: -
refs: core/receptacles.md (a tier's own replace point under an upstream route's _components/) | core/ownership.md shelf | order 20261124-192410-tier1-tests-fork-additions
notes: no fork-side test edits | a fork test line that fails for a wrong path of its own (e.g. a CATALOG line naming a missing folder) stays the fork's to fix
