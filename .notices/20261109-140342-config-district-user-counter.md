# DOWNSTREAM NOTICE id:20261109-140342-config-district-user-counter
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-09T14:03:42+09:00
severity: action-required
checkpoint: config-district-user-counter
moved: src/config/app/user-counter.config.ts -> src/config/features/userCounter.config.ts
change: the userCounter values moved from src/config/app/user-counter.config.ts (deleted) to their owner src/features/core/userCounter/config.ts (defaults, type UserCounterOverride, composed userCounterConfig) with the empty override src/config/features/userCounter.config.ts. Old name -> new key: USER_COUNTER_CONFIG.defaultRetentionDays -> userCounterConfig.defaultRetentionDays, USER_COUNTER_CONFIG.dailyTimeZone -> userCounterConfig.dailyTimeZone. Values unchanged (730, "Asia/Tokyo").
why: a fork that changed the values in the old file loses them (the file is gone), and a fork file importing @/config/app/user-counter.config fails typecheck
required_actions:
1. Merge upstream up to this checkpoint. If the merge keeps a fork version of src/config/app/user-counter.config.ts (modify/delete conflict), copy its changed values first, then delete the file: `git show HEAD:src/config/app/user-counter.config.ts`.
2. Write only the values the fork changed into src/config/features/userCounter.config.ts as literals: `export default { defaultRetentionDays: <n>, dailyTimeZone: "<tz>" } satisfies UserCounterOverride;` (leave out a key the fork did not change). [判断] 88-base, TriQ, boardgame-site, next-vnx, oripa-do: the old file equals upstream → nothing to write.
3. Rewrite fork imports: `git grep -nE "config/app/user-counter\.config|USER_COUNTER_CONFIG" -- src scripts` → read `userCounterConfig` from `@/features/userCounter/config` and use `.defaultRetentionDays` / `.dailyTimeZone` (no re-export of the old name).
verify: the git grep in step 3 finds nothing | pnpm check config-overrides passes | pnpm typecheck | pnpm lint
manual_steps: -
refs: src/features/core/userCounter/config.ts, src/config/features/userCounter.config.ts, src/features/core/userCounter/README.md, src/config/README.md, order 20261109-131133-config-district-user-counter
notes: Fork copies were compared with git show HEAD:src/config/app/user-counter.config.ts in each fork of fleet.conf (read-only); all equal upstream. src/registry/district-map.jsonl now marks the userCounter config and override as existing.
