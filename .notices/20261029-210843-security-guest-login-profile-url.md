# DOWNSTREAM NOTICE id:20261029-210843-security-guest-login-profile-url
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-29T21:08:43+09:00
severity: action-required
checkpoint: security-guest-login-profile-url
change: Security fixes taken upstream: (1) POST /api/auth/guest-login is rate-limited by a new RATE_LIMIT_CONFIG key `guestLogin` (same IP, 5 per hour); (2) upsertProfile (the single write path for profile data: /api/me/profile, admin user create/update, demo user creation) rejects with 400 any non-empty string whose key ends in `Url` unless it is an http(s) URL; new util `isSafeHttpUrl` in src/utils/url.ts. Password hashes in user API responses were already closed upstream by hiddenColumns (5a100dce) — fork-side redaction of localPassword is no longer needed.
why: Without `guestLogin` in the fork's rate-limit.config.ts the route no longer type-checks; fork copies of these fixes now duplicate upstream and count as changes outside the intake for the ownership check.
required_actions:
1. Merge upstream up to this checkpoint. If src/config/app/rate-limit.config.ts conflicts or lacks the key, add `guestLogin: { windowSeconds: 3600, maxRequests: 5 }` (keep the fork's own values for other keys); `pnpm typecheck` reports it if missing.
2. If the fork had its own src/utils/url.ts (add/add conflict): take upstream's file; if the fork's version exported more helpers, move those into a fork-owned file (e.g. src/utils/<project>Url.ts) and update imports (`git grep -n "@/utils/url" -- src`).
3. Revert fork-side copies of these fixes to upstream's version: a `rateLimit: "guestLogin"` line already added by the fork in src/app/api/auth/guest-login/route.ts (merge usually resolves it), a profileData `*Url` check in src/app/api/me/profile/route.ts, and `redactLocalPassword` calls / src/features/core/user/services/server/helpers/sanitizeUser.ts (find: `git grep -n "redactLocalPassword\|isSafeHttpUrl" -- src`). Restore each touched upstream file with `git checkout upstream/main -- <path>` after confirming the diff is only that fix.
4. Name any profile field that holds a URL `<name>Url` (src/features/core/userProfile/README.md「URL の項目」).
verify: `pnpm typecheck` and `pnpm lint` pass; `git grep -n "redactLocalPassword" -- src` prints nothing.
manual_steps: -
refs: src/config/app/rate-limit.config.ts, src/app/api/auth/guest-login/route.ts, src/features/core/userProfile/services/server/operations/upsertProfile.ts, src/utils/url.ts, src/features/core/user/entities/drizzle.ts (defineHiddenColumns)
notes: Fork impact checked: boardgame-site already has guestLogin and redactLocalPassword (steps 1/3); voranowa has its own src/utils/url.ts and the profile route check (steps 2/3); 88-base, TriQ, oripa-do, next-vnx, pandora have neither (step 1 only).
