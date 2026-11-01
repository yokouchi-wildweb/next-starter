# DOWNSTREAM NOTICE id:20261101-183106-actor-through-routes
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:feature/bundle2-crud-db | commit:(this commit)
date: 2026-11-01T09:31:06Z
severity: action-required
checkpoint: actor-through-routes
resolves: 20261101-124453-crud-service-actor-argument
change: docs only, no new API; generic CRUD create / update will not receive the user; work needing the user = own route -> method with a required principal argument -> generic path closed
why: an actor on create / update alone would leave read, count, relation expansion, upsert, bulk and duplicate unprotected, and an optional argument makes a missed user a permission hole; the existing means already cover the need, so the order is answered with this rule and a migration guide
required_actions:
1. Find services that read the session: git grep -n "getSessionUser\|getAuditContext" -- src/features . Keep audit recording uses. Migrate uses that authorize or decide business logic, using the steps in src/lib/routeFactory/README.md 業務処理に利用者が要るとき.
2. Find own-row input trusted from the client: git grep -n "user_id" -- src/features/*/services/server/wrappers . On a domain whose generic create / update is open to non-admins, set user_id from ctx.user on the server in an own route, and reject owner changes on update.
3. oripa-do: move mediaAsset create / update that need the user to an admin createApiRoute passing ctx.user. src/features/mediaAsset/services/server/wrappers/purposeValidation.ts :79 resolveRead loadUser: getSessionUser becomes a loader returning the passed user, :93 discard gets the passed user. Close the generic writes with apiAccess write "none", change the mediaAsset hooks to the new route.
verify: pnpm typecheck passes; for each migrated domain check: another user's id is rejected; the generic /api/<domain> write returns 404; a stopped user is rejected; an internal call with no user uses a named system method
manual_steps: -
refs: src/lib/routeFactory/README.md, src/features/core/auditLog/README.md context, src/features/core/user/services/server/wrappers/update.ts updateSelf, .notices/20261030-105956-route-factory-wiring.md step 6, .notices/20261030-205135-guard-fixes.md
notes: no runtime change upstream. Forks that have nothing to migrate have nothing to do. The lint session-api-callsite still does not cover fork services. Generic ownership as a framework feature is out of scope here and would need its own design. oripa-do line numbers come from research on its checkout at the time of the order. Tier3 forks get this through their parent's /flux.
