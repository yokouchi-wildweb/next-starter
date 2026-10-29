# DOWNSTREAM NOTICE id:20261029-112204-screen-components-move
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-29T11:22:04+09:00
severity: info
checkpoint: screen-components-move
change: Upstream no longer keeps files under `src/app/**/_components/` (the folder is fork-owned: downstream replacement Screens and page-only parts). The six demo parts upstream had there moved to `_screen/` of the same route, contents unchanged (only the path comment on line 1); each demo page.tsx now imports `./_screen/<Part>`. New check in `pnpm test:screens`: upstream (Tier1 only, the same ownership check as the existing dot-name test) fails when any file exists under a `_components/` folder in src/app; forks skip it. `_` means different things by place: `_screen/` and `_layout/` = the provider's default, `_components/` = fork-owned.
why: The council report on shared-folder placement keeps `_components/` as the fork's own place and the provider's defaults in `_screen/` / `_layout/`; upstream files in `_components/` collide with what forks put there and blur who owns them.
moved:
- src/app/(user)/demo/async-picker-modal/_components/SamplePickerDemo.tsx -> src/app/(user)/demo/async-picker-modal/_screen/SamplePickerDemo.tsx
- src/app/(user)/demo/fingerprint/_components/FingerprintDemo.tsx -> src/app/(user)/demo/fingerprint/_screen/FingerprintDemo.tsx
- src/app/(user)/demo/seamless-av/_components/SeamlessAvDemo.tsx -> src/app/(user)/demo/seamless-av/_screen/SeamlessAvDemo.tsx
- src/app/(user)/demo/seamless-av/play/_components/SeamlessAvPlayer.tsx -> src/app/(user)/demo/seamless-av/play/_screen/SeamlessAvPlayer.tsx
- src/app/(user)/demo/seamless-video/_components/SeamlessVideoDemo.tsx -> src/app/(user)/demo/seamless-video/_screen/SeamlessVideoDemo.tsx
- src/app/(user)/demo/sortable-list/_components/SampleSortableList.tsx -> src/app/(user)/demo/sortable-list/_screen/SampleSortableList.tsx
required_actions:
1. Merge upstream up to this checkpoint. If the fork edited any of the six files above, /flux re-applies those edits at the new path (moved:). If the fork deleted a demo route, keep it deleted on the modify/delete conflict.
2. Files the fork itself added to `_components/` of these demo routes (or anywhere) stay where they are: `_components/` remains the fork's place. If such a fork file imports one of the moved parts with `./<Part>`, change it to `../_screen/<Part>`.
3. A mid tier with downstream forks: judge the relay in /flux as usual.
verify: `pnpm typecheck` | `pnpm test:screens` | `pnpm lint` reports no new error | the demo pages (/demo/async-picker-modal, /demo/fingerprint, /demo/seamless-av, /demo/seamless-av/play, /demo/seamless-video, /demo/sortable-list) render as before
manual_steps: -
refs: src/lib/screens/checks.mjs (findForkOwnedDirFiles), src/lib/screens/screens.test.mjs, src/lib/screens/README.md (§1 directory map, §9 upstream の置き場の印), .claude/rules/core/screens.md (route), council report 20261019-213253-shared-folders-placement-ownership §2
notes: No DB change, no db:push. | The check runs only in the canonical upstream (forks put their own Screens and parts in `_components/`). | Demo pages stay outside the switch-form checks (SCAN_EXCLUDES) and the eslint demo ignore is path-based, so both still apply.
