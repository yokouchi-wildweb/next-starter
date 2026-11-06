# DOWNSTREAM NOTICE id:20261106-143026-exchange-auth-time-invalidation
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-06T14:30:26+09:00
severity: info
checkpoint: exchange-auth-time-invalidation
change: Firebase ID-token → app-session exchange (createFirebaseSession login, register) rejects a token whose auth_time is before users.sessions_invalidated_at with 401 (same error as a failed verifyIdToken), even when Firebase refresh-token revocation failed; the comparison lives in src/features/core/auth/services/server/session/invalidationBoundary.ts and resolveSessionUser (token.ts) now uses it too (same rule as before: seconds, same second passes)
why: a user whose sessions were invalidated (password change, ban, lockout) could mint a new app session from a Firebase session authenticated before the invalidation when revokeRefreshTokens failed; forks see such logins / registrations refused (re-login required)
required_actions: none
verify: pnpm test:establish-session passes; pnpm typecheck passes
manual_steps: -
refs: src/features/core/auth/services/server/session/invalidationBoundary.ts | src/features/core/auth/services/server/firebaseSession.ts | src/features/core/auth/services/server/registration.ts | src/features/core/auth/README.md「強制失効」 | order 20261105-200512-exchange-auth-time-vs-invalidation
notes: a fork's own ID-token exchange that issues a session should call assertAuthenticatedAfterInvalidation(decodedToken, user) before issueSessionToken. preRegistration and verifyPhoneOtp issue no session and are unchanged.
