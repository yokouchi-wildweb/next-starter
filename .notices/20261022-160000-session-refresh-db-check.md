# DOWNSTREAM NOTICE id:20261022-160000-session-refresh-db-check
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-22T16:00:00+09:00
severity: action-required
checkpoint: session-refresh-db-check
change: SECURITY fix. GET /api/auth/session (src/app/api/auth/session/route.ts) now resolves the session through resolveSessionUser (JWT verify + DB lookup + users.sessions_invalidated_at check) and re-signs the token from the DB row via refreshSessionCookie; invalidated / missing user → 401 + session cookie cleared. refreshSessionCookie (src/features/core/auth/services/server/session/token.ts) now applies the demo maxAge (APP_FEATURES.auth.session.demoMaxAgeSeconds) for isDemo users and returns { expiresAt } (was void).
why: the route used to re-sign the OLD token's claims with a fresh iat, so a token revoked by invalidateSessionsForUser (password change / ban / security lock) could be laundered into a new valid token within its max-age, and stale role/status claims were re-signed. Response shape { user, session.expiresAt } is unchanged.
required_actions:
1. Merge upstream. If the fork never edited src/app/api/auth/session/route.ts or refreshSessionCookie, nothing else to do.
2. If the fork had edited src/app/api/auth/session/route.ts (merge conflict, or `git log --oneline <merge-base>..HEAD -- src/app/api/auth/session/route.ts` shows fork commits): take upstream's version and re-apply the fork's intent on top of it. The token MUST come from resolveSessionUser(token) and be signed with refreshSessionCookie(cookies, sessionUser); never re-sign claims parsed from the old token.
3. Search fork-owned code for the same pattern: `grep -rn "signUserToken" src --include=*.ts --include=*.tsx` (excluding src/lib/jwt/). For every hit that re-signs claims taken from an existing cookie token (verifyUserToken / resolveSessionUserFromTokenOnly / getTokenOnlySession output) instead of a DB-backed SessionUser, switch it to resolveSessionUser + refreshSessionCookie.
4. If fork code calls refreshSessionCookie for a demo user and relied on the 7-day lifetime, note that demo users now get demoMaxAgeSeconds (same as login/refresh).
verify: `pnpm test:auth-session-refresh` passes | `npx tsc --noEmit` passes | `grep -n "verifyUserToken" src/app/api/auth/session/route.ts` returns nothing
manual_steps: -
refs: src/app/api/auth/session/route.ts, src/app/api/auth/session/route.test.mts, src/features/core/auth/services/server/session/token.ts, src/features/core/auth/README.md (セッション)
notes: no DB change. One extra DB read per refresh call (same cached path as getSessionUser). Forks: not checked.
