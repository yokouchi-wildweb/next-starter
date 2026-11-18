---
paths:
  - "src/lib/routeFactory/**"
---
# lib/routeFactory
what: the generic API route factories (createApiRoute, createDomainRoute / createDomainIdRoute, createMeRoute, createDeviceRoute, enforceAccessRule) | routes import the wired version @/wiring/apiRoute (src/wiring/apiRoute.ts)
use: always
change: add = a fork's own principal factory in src/wiring/<name>.ts built from createRouteFactories
rules:
using:
- public_read_all_public: generic read "public" only when every record is public (search, count, relations too)
- user_skip_untouched: `user: "skip"` only on public routes that never read ctx.user
- unavailable_is_retry: 503 route_user_unavailable = retry, never treat it as signed out
- actor_required: generic create / update never take a user | work needing one = own route → business method with the principal as a required argument → close the generic write
- no_soft_actor: never an optional actor after tx, a session read inside a service or authorization by AuditContext | callers without a user call named system methods
- owner_server_side: a self-owned row's user_id comes from ctx.user.userId; input changing the owner is rejected; createMeRoute proves sign-in only, the owner check is the business method's
- device_scope: device routes take store / table from device.scope, never a client id | a device never joins createApiRoute access | an existing route opened to devices adds the scope check
- demo_by_factory: demo skipping is the factory's
- return_url_confirms_nothing: a provider return route only redirects
editing:
- authz_before_demo: access is evaluated before the demo skip
- resolve_user_contract: resolveUser returns null = known absent, throws = cannot verify
- lib_knows_no_features: principal types come as type params; never imports features
read: pick a factory, user-needed work, webhooks → Usage | access table, principal, factories, errors → API | own factory → Extension | generic build → Internals | checks → Verification
