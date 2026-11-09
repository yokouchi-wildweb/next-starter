# DOWNSTREAM NOTICE id:20261109-140418-config-district-interaction-tracking
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-09T05:04:18Z
severity: action-required
checkpoint: config-district-interaction-tracking
moved: src/config/app/interaction-tracking.config.ts -> src/config/features/interactionTracking.config.ts
change: the interaction tracking settings moved from src/config/app/interaction-tracking.config.ts (deleted) to their owner src/features/core/interactionTracking/config.ts (defaults, types InteractionTrackingConfig / InteractionTrackingOverride, composed interactionTrackingConfig) with the empty override src/config/features/interactionTracking.config.ts. Old name -> new key: INTERACTION_TRACKING_CONFIG.counterShardCount -> interactionTrackingConfig.counterShardCount, INTERACTION_TRACKING_CONFIG.defaultRetentionDays -> interactionTrackingConfig.defaultRetentionDays, INTERACTION_TRACKING_CONFIG.aggregationTimeZone -> interactionTrackingConfig.aggregationTimeZone. Values unchanged.
why: a fork that changed a value in the old file loses it (the file is gone), and a fork file importing @/config/app/interaction-tracking.config fails typecheck
required_actions:
1. Merge upstream up to this checkpoint. If the merge keeps a fork version of src/config/app/interaction-tracking.config.ts (modify/delete conflict), copy its values first (`git show HEAD:src/config/app/interaction-tracking.config.ts`), then delete the file.
2. Write changed values into src/config/features/interactionTracking.config.ts as literals: `export default { defaultRetentionDays: 180 } satisfies InteractionTrackingOverride;` (only the keys the fork changed). [判断] 88-base, TriQ, boardgame-site, next-vnx, oripa-do, pandora: the old file has upstream's values (read-only check of the current checkouts); voranowa has no such file → nothing to write.
3. Rewrite fork imports: `git grep -nE "config/app/interaction-tracking\.config|INTERACTION_TRACKING_CONFIG" -- src scripts` → read `interactionTrackingConfig` from `@/features/interactionTracking/config` (no re-export of the old name).
verify: the git grep in step 3 finds nothing | pnpm check config-overrides passes | pnpm typecheck | pnpm lint | pnpm test src/features/core/interactionTracking
manual_steps: -
refs: src/features/core/interactionTracking/config.ts, src/config/features/interactionTracking.config.ts, src/config/README.md, order 20261109-131132-config-district-interaction-tracking (council 20261101-233830 D95)
notes: the feature gate rule interactionTracking (always open) is not touched.
