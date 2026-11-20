# DOWNSTREAM NOTICE id:20261120-064023-shelf-s0-login-form-nav-route-factory
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:qc/kagerou/secretary | commit:(this commit)
date: 2026-11-20T06:40:23+09:00
severity: action-required
checkpoint: shelf-s0
moved: src/utils/stringCase.mjs -> src/lib/stringCase/index.mjs; src/lib/routeFactory/createApiRoute.test.mts -> src/wiring/routeFactory.test.mts; src/lib/routeFactory/collectionEntriesRoute.test.mts -> src/app/api/collectionEntriesRoute.test.mts
resolves: 20261101-200104-user-login-split-email-form, 20261108-142104-frame-hide-empty-nav
change: (1) auth: the login email form is a public part UserLoginEmailForm (entry @/features/core/auth/components/UserLogin, prop redirectTo); UserLogin looks and behaves the same. (2) user frame: header nav with no items renders no nav parts (PC nav, SP toggle button and panel); the default bottom nav with no items renders no spacer and does not write --app-bottom-nav-height (0px); forks with items keep the same DOM. UserFrame.test checks upstream declarations from frame.ts only (runs in forks too). (3) src/utils/stringCase becomes the closed lib src/lib/stringCase (entry @/lib/stringCase/index.mjs); src/lib/routeFactory is closed (entry @/lib/routeFactory only, the override type RouteFactoryOverride from the entry too); lint lib-entry stops imports of inner files and the old @/utils/stringCase
why: the closed libs stop fork imports of @/utils/stringCase and @/lib/routeFactory/<inner file> (lint lib-entry error); forks that changed upstream routes in their frame.ts fail UserFrame.test; the login form and empty-nav changes let forks drop copies they kept only to change these
required_actions:
1. Take in up to this checkpoint.
2. Run `pnpm check lib-package -- codemod --base <the upstream commit taken in before this segment (the previous upstream:<sha> in .notices/applied/<fork>.md)>` (dry-run), then the same with `--apply`. It rewrites the fork's own files: @/utils/stringCase.mjs, ../src/utils/stringCase.mjs and @/lib/routeFactory/<inner> to the entries (relative imports of .mjs tools stay relative).
3. Rewrite by hand what the codemod stopped on, to named imports from the entry. Import map: @/utils/stringCase.mjs -> @/lib/stringCase/index.mjs; @/lib/routeFactory/config -> @/lib/routeFactory; @/lib/routeFactory/createApiRoute -> @/lib/routeFactory.
4. If the fork edited src/config/lib/routeFactory.config.ts, import its type from `@/lib/routeFactory`.
5. Forks that change upstream routes in their own frame.ts: move that to frame.override.ts (`pnpm check extensions -- frames-move`).
6. Optional: a fork that keeps Header / BottomNav / BottomNavSpacer .replace files or items.length checks only to hide empty items may delete them (`git grep -n -E 'items\.length' -- 'src/app/**/_layout'` and the .replace files beside them).
7. Optional: a fork that copied UserLogin only to change the login methods may delete the copy and compose UserLoginEmailForm with its own methods in its Screen (the copy keeps working).
verify: `git grep -n "utils/stringCase" -- src scripts` returns 0 lines | `pnpm check lib-package` exit 0 | `pnpm typecheck` | `pnpm lint` | `pnpm test src/app/(user)/_layout` | pnpm typecheck passes including upstream _screen/* default screens even where your page.tsx points to _components/; a failure there = your fork's core edit is not backward compatible (CLAUDE.md CORE_FILES fork_core_edit_compat) — fix the core side, do not edit the upstream Screen
manual_steps: -
refs: 69bcc3047 (auth UserLoginEmailForm) | 4efa45db0 (user layout empty nav) | 267733e82 (stringCase / routeFactory closed) | src/lib/README.md (closing a lib) | quests 20261119-210119-user-login-split-email-form, 20261119-210118-frame-hide-empty-nav, 20261119-210119-route-factory-close (council 20261030-212344 c1)
notes: one notice for segment shelf-s0 (three quests); the quests' own checkpoint lines (user-login-email-form, own, route-factory-close) are folded into shelf-s0. Forks with items in their nav see no DOM change.
