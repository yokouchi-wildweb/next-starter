# DOWNSTREAM NOTICE id:20261105-182611-extension-items-coin-sources
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-05T18:26:11+09:00
severity: info
checkpoint: extension-items-coin-sources
fixes: commit:1324eedb
change: scripts/extensions/upstreamItems.test.mts expectations follow the coin issuance change of 1324eedb: upstream coinIssuanceSources items are purchaseBonusGap and walletBonusGrant (referralReward / couponAttributionReward were deleted), COIN_ISSUANCE_LABELS keys include wallet_bonus_grant, and the item sets of the newer receptacles are pinned (analytics exclusionProviders: none, walletHistory reasonKeys: adminAdjustment, couponAttributionReward). Test file only, no runtime change.
why: Since 1324eedb, pnpm test:extension-items failed 2 cases on the upstream tree (stale expectations), so a fork that merged that commit saw the same 2 failures.
required_actions: none
verify: pnpm test:extension-items
manual_steps: -
refs: scripts/extensions/upstreamItems.test.mts, commit 1324eedb, notice 20261105-123320-coin-issuance-ledger-source
notes: The failure was in the test's expectations, not in the code; forks that skipped test:extension-items were not affected at run time.
