# DOWNSTREAM NOTICE id:20261109-140836-config-district-wallet-c
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-09T14:08:36+09:00
severity: action-required
checkpoint: config-district-wallet-c
moved: src/config/app/coupon-attribution.config.ts -> src/config/features/couponAttributionReward.config.ts
change: the recipient-visible metadata allowlist moved from src/config/app/coupon-attribution.config.ts (deleted) to its owner src/features/core/couponAttributionReward/config.ts (defaults, type CouponAttributionRewardOverride, composed couponAttributionRewardConfig) with the empty override src/config/features/couponAttributionReward.config.ts. Old name -> new key: RECIPIENT_VISIBLE_ATTRIBUTION_REWARD_METADATA_KEYS -> couponAttributionRewardConfig.recipientVisibleAttributionRewardMetadataKeys. Default unchanged ([], fail-closed).
why: a fork that listed keys in the old file loses them (the file is gone) and GET /api/me/coupon-attribution-rewards silently stops returning those metadata keys; a fork file importing @/config/app/coupon-attribution.config fails typecheck
required_actions:
1. Merge upstream up to this checkpoint. If the merge keeps a fork version of src/config/app/coupon-attribution.config.ts (modify/delete conflict), copy its list first (`git show HEAD:src/config/app/coupon-attribution.config.ts`), then delete the file.
2. Write the fork's list into src/config/features/couponAttributionReward.config.ts: `export default { recipientVisibleAttributionRewardMetadataKeys: ["<key>", ...] } satisfies CouponAttributionRewardOverride;`. [判断] oripa-do: its list is ["rewardRate", "paymentAmount"] → write exactly these two. 88-base, TriQ, boardgame-site, next-vnx: empty list → nothing to write.
3. Rewrite fork imports: `git grep -nE "config/app/coupon-attribution\.config|RECIPIENT_VISIBLE_ATTRIBUTION_REWARD_METADATA_KEYS" -- src scripts` → read `couponAttributionRewardConfig` from `@/features/couponAttributionReward/config` and use `.recipientVisibleAttributionRewardMetadataKeys` (no re-export of the old name).
verify: the git grep in step 3 finds nothing | pnpm check config-overrides passes | pnpm typecheck | pnpm lint | oripa-do: the mypage coupon usage history still shows the reward rate and purchase amount
manual_steps: -
refs: src/features/core/couponAttributionReward/config.ts, src/config/features/couponAttributionReward.config.ts, src/features/core/couponAttributionReward/README.md, src/config/README.md, order 20261109-135841-config-district-wallet-c (council 20261101-233830 D95)
notes: fork lists were read read-only from each fork of fleet.conf (git show HEAD:src/config/app/coupon-attribution.config.ts).
