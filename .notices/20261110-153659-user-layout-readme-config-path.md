# DOWNSTREAM NOTICE id:20261110-153659-user-layout-readme-config-path
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:quest/riddle | commit:- (this commit)
date: 2026-11-10T15:36:59+09:00
severity: info
checkpoint: user-layout-readme-config-path
resolves: 20261110-130441-user-layout-readme-stale-config-path
change: docs only. src/app/(user)/_layout/README.md (fork replacement step 1, section 設定ファイル, history lines) and src/styles/README.md (layer 2 and 枠の中身 rows) no longer point at the deleted src/config/ui/user-*.config.ts; they name the user frame's config pair (owner src/app/(user)/_layout/config.ts / config.ui.ts, overrides src/config/layout/user.config.ts / user.ui.config.ts; background = layout.background). History lines keep the old path marked as 当時の.
why: the READMEs sent forks to config files removed by notice 20261109-144721-config-district-user-frame
required_actions: none
verify: git grep -nE "config/ui/user-|user-layout\.config" -- ':!.notices' finds only history lines marked 当時の / 今は and scripts/structure/config-overrides/pairing.test.mjs (intentional fixture)
manual_steps: -
refs: src/app/(user)/_layout/README.md, src/styles/README.md, notice 20261109-144721-config-district-user-frame, order 20261110-130441-user-layout-readme-stale-config-path
notes: no code change, no db:push.
