# DOWNSTREAM NOTICE id:20261024-183535-pause-withdraw-feature-gate
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-24T18:35:35+09:00
severity: action-required
checkpoint: pause-withdraw-feature-gate
change: APP_FEATURES.user.pauseEnabled / withdrawEnabled are now enforced by the feature gate (src/config/app/feature-gate.config.ts), not only by hiding menu items. New rules: pause = /mypage/pause, /api/auth/pause; withdraw = /mypage/withdraw, /api/auth/withdraw; other actions = /mypage/other (enabled when pause OR withdraw is enabled). A disabled rule returns 404 for those pages and APIs. MainMenu shows "その他の操作" only when pause or withdraw is enabled (before, it always showed and led to an empty page with the upstream defaults). Not gated on purpose: /reactivate and /api/auth/reactivate (already-paused users must still be able to come back after pause is turned off; the /reactivate page keeps its own loader check).
why: With the flags false, POST /api/auth/withdraw and /mypage/withdraw still worked (and POST /api/auth/pause), so a fork that "disabled" withdrawal still let any logged-in user withdraw by opening the URL or calling the API. Forks that rely on these endpoints while the flag is false will now get 404.
required_actions:
1. Merge upstream up to this checkpoint.
2. Check the fork's values in src/config/app/app-features.config.ts: `user.pauseEnabled` and `user.withdrawEnabled`. If the fork offers pause / withdraw to users (own menu, own screen, own call to /api/auth/pause or /api/auth/withdraw: find with `grep -rn "api/auth/pause\|api/auth/withdraw\|/mypage/pause\|/mypage/withdraw\|/mypage/other" src`), set the matching flag to true. If it does not, leave it false (the endpoints are now closed, which is the intended fix).
3. If the fork added its own pages or APIs under these features, add their paths to the matching rule in feature-gate.config.ts (CLAUDE.md feature_gate).
4. Run `pnpm test:feature-gate`.
verify: `pnpm typecheck` | `pnpm test:feature-gate` | with withdrawEnabled false: `curl -i -X POST <origin>/api/auth/withdraw` → 404, /mypage/withdraw → 404; with it true, withdrawal works as before | MainMenu hides "その他の操作" when both flags are false
manual_steps: -
refs: src/config/app/feature-gate.config.ts | src/features/core/user/components/MainMenu.tsx | src/config/app/app-features.config.ts (user.pauseEnabled / withdrawEnabled) | src/proxies/README.md | order 20261019-122328-fork-extension-points-bundle item (22)
notes: No DB change, no db:push (no tables in these rules). | Admin-side pause / withdraw operations are not under these paths and are unaffected.
