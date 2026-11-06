# DOWNSTREAM NOTICE id:20261106-133656-local-login-without-firebase
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-06T13:36:56+09:00
severity: info
checkpoint: local-login-without-firebase
change: admin local (DB-password) login completes without Firebase: localLogin returns firebaseCustomToken null when isFirebaseServerConfigured() is false (LocalLoginResult / LocalLoginResponse firebaseCustomToken: string | null), and useAdminLogin calls signInWithCustomToken only when a token came back and isFirebaseClientConfigured() is true; with Firebase configured nothing changes
why: with MY_SERVICE_ACCOUNT_KEY empty the login used to fail on createCustomToken after the session was issued; this also lifts the constraint in notice 20261106-110435-agent-dev-server-tools manual_steps (pnpm task dev-admin logins no longer need the Firebase server env)
required_actions: none
verify: pnpm test:local-login passes; pnpm typecheck passes (a fork caller that reads firebaseCustomToken as string now sees string | null — guard it like useAdminLogin)
manual_steps: -
refs: src/features/core/auth/services/server/localLogin.ts | src/features/core/auth/hooks/useAdminLogin.ts | src/features/core/auth/README.md | notice 20261106-110435-agent-dev-server-tools | order 20261105-121259-local-login-without-firebase
notes: configured-but-failing Firebase still fails the login (outages are not hidden). The custom token's uid / claims, session / JWT logic and useFirebaseAuthSync are unchanged.
