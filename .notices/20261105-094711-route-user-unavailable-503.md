# DOWNSTREAM NOTICE id:20261105-094711-route-user-unavailable-503
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-05T09:47:11+09:00
severity: info
checkpoint: route-user-unavailable-503
resolves: 20261102-155755-route-user-resolution-db-failure-and-cost
change: Route Factory user resolution. (1) When the DB-synced user lookup fails on a DB error, every Factory (createApiRoute of any access, createMeRoute, createDomainRoute, createDeviceRoute orUser) now answers 503 with code "route_user_unavailable" (RouteUserUnavailableError) instead of 401; the handler is not reached and JWT claims are never used as a fallback. (2) createApiRoute takes `user: "skip"` for access "public" only: the Factory does not read users and ctx.user is always null (other accesses: type error; at run time 500 route_access_invalid). Default (no `user`) is unchanged. Page guards, proxy and AuthSessionProvider still treat a DB failure as "no user".
why: A logged-in user got 401 "認証が必要です" during a DB outage, which clients read as "not logged in"; public routes that never touch ctx.user paid one users SELECT per request.
required_actions:
1. None required. Merge upstream up to this checkpoint.
2. Optional: public routes that never read ctx.user may add `user: "skip"` to their createApiRoute config to drop the users read. Find candidates: git grep -n 'access: "public"' -- 'src/app/api' ; add it only where the handler does not use `user` (the handler's ctx.user becomes null).
3. Optional: client code that reads a 401 from these APIs as "logged out" (redirect to login, clear state) should treat 503 with body code "route_user_unavailable" as a temporary failure and retry instead. Find candidates: git grep -nE "status === 401|=== 401|\b401\b" -- 'src' ':!src/features/core' ':!src/lib'
verify: pnpm typecheck | pnpm test:route-factory | pnpm test:device-route
manual_steps: -
refs: src/lib/routeFactory/routeUser.ts, src/lib/routeFactory/README.md (主体の決まり), src/lib/routeFactory/deps.ts (RouteUserDeps.resolveUser contract), src/features/core/auth/services/server/session/getSessionUser.ts (getSessionUserForRoute), order 20261102-155755-route-user-resolution-db-failure-and-cost
notes: RouteUserDeps.resolveUser contract is now explicit: null = no user (logged out / invalidated / deleted), throw = cannot tell (outage) and the Factory turns the throw into the 503. A fork that builds its own Factory from the generic one with its own user bundle (src/wiring/<name>.ts) should throw on outage instead of returning null. Tests that mock "@/features/core/auth/services/server/session/getSessionUser" with mock.module must also export getSessionUserForRoute (apiRouteUserDeps imports it). Authenticated / role routes still read the DB-synced user every request (sessionsInvalidatedAt check kept), so oripa-do's draw / loop / rush keep their users read; only public routes can skip it. Not verified against a real DB outage (covered by the Factory tests with a throwing bundle).
