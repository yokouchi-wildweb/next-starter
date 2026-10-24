# DOWNSTREAM NOTICE id:20261024-180928-transition-guard-path-query
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-24T18:09:28+09:00
severity: info
checkpoint: transition-guard-path-query
change: lib/transitionGuard now matches the token's target against the current path by pathname only: query (`?…`) and hash (`#…`) on the guardedPush / guardedReplace target are ignored (new src/lib/transitionGuard/matchTargetPath.ts: toGuardPath, matchesTargetPath; issueToken stores the stripped path, validateGuard compares with matchesTargetPath). Exact match only, no prefix match. Before this, any guarded navigation with a query always failed with path_mismatch, including upstream's OAuth signup (`guardedPush("/signup/register?method=thirdParty")` → Registration's useTransitionGuard onFail "error"). New test: `pnpm test:transition-guard`.
why: Forks using guardedPush with a query either hit path_mismatch or patched lib/transitionGuard locally (boardgame-site reported it). The local patch is no longer needed.
required_actions:
1. Merge upstream up to this checkpoint. If the fork patched src/lib/transitionGuard/validateToken.ts or issueToken.ts for this (find: `git diff upstream/main -- src/lib/transitionGuard`), take upstream's version on conflict and drop the local patch.
2. If the fork worked around it at call sites instead (passing the query some other way, or onFail "none" to swallow path_mismatch), it may revert to `guardedPush("<path>?<query>")`. Optional.
verify: `pnpm typecheck` | `pnpm test:transition-guard` | OAuth signup reaches /signup/register?method=thirdParty without the guard error; email signup /signup/register → /signup/complete still passes
manual_steps: -
refs: src/lib/transitionGuard/matchTargetPath.ts, validateToken.ts, issueToken.ts, README.md | src/features/core/auth/components/OAuth/index.tsx:46 | order 20261019-122328-fork-extension-points-bundle item (17)
notes: No DB change, no db:push. | Tokens already stored in sessionStorage with a query in targetPath also pass (the comparison strips both sides).
