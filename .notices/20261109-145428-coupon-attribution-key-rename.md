# DOWNSTREAM NOTICE id:20261109-145428-coupon-attribution-key-rename
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261023-175358-config-redesign.1 | commit:- (this commit)
date: 2026-11-09T14:54:28+09:00
severity: action-required
checkpoint: coupon-attribution-key-rename
fixes: 20261109-140836-config-district-wallet-c
change: renamed key (council D99): couponAttributionRewardConfig.recipientVisibleAttributionRewardMetadataKeys -> couponAttributionRewardConfig.recipientVisibleMetadataKeys (src/features/core/couponAttributionReward/config.ts; same type and default []; override key in src/config/features/couponAttributionReward.config.ts) | src/lib/screens/checks.mjs findDotNamedFiles (Tier1-only check) now returns only fork replacement marks (.replace / .override by classifyDottedName) instead of every dotted name with a config.ui.ts name exception; findMarkerNamedFiles (all tiers) allows config.ui.ts only directly in a frame's _layout/ (the district UI_CONFIG_FILE) — no fork tree changes (checked: 0 findings in the 5 forks)
why: a fork that wrote the old key in its couponAttributionReward override would silently lose it (the override would carry an unknown key, the allow list would fall back to [] = nothing shown to recipients)
required_actions:
1. Merge upstream up to this checkpoint. If src/config/features/couponAttributionReward.config.ts sets recipientVisibleAttributionRewardMetadataKeys, rename that key to recipientVisibleMetadataKeys (value unchanged). oripa-do: `export default { recipientVisibleMetadataKeys: ["rewardRate", "paymentAmount"] } satisfies CouponAttributionRewardOverride;` (its value from the earlier notice's step).
2. `git grep -n "recipientVisibleAttributionRewardMetadataKeys" -- src scripts` prints nothing (fork code reading the old key → the new key).
verify: git grep -n "recipientVisibleAttributionRewardMetadataKeys" -- src scripts prints nothing | pnpm typecheck | pnpm test src/lib/screens
manual_steps: -
refs: src/features/core/couponAttributionReward/config.ts, src/features/core/couponAttributionReward/README.md, src/lib/screens/checks.mjs, src/lib/screens/README.md, council 20261023-175358-config-redesign decisions D99 D101 L1.32 L1.33, legate:l1 order:38
notes: a fork that applies both notices in one segment writes the new key once. | the fingerprint config keeps its collection / challenge levels (D101: they name the kind of processing; flattening would mix the top-level enabled with the gate switch), so 20261109-141931-config-district-fingerprint stays as shipped.
