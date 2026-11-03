# DOWNSTREAM NOTICE id:20261103-125116-route-transition-overlay-removed
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:fix/bundle4 | commit:- (this commit)
date: 2026-11-03T12:51:16+09:00
severity: action-required
checkpoint: route-transition-overlay-removed
resolves: 20261102-114025-route-transition-overlay-app-router
change: deleted src/components/Overlays/Loading/RouteTransition.tsx (RouteTransitionOverlay), src/hooks/useRouteChangeEffect.ts and src/hooks/useRouteTransitionPending.ts; src/app/layout.tsx no longer imports or mounts <RouteTransitionOverlay />. No next/router Router.events use remains in src. Route feedback stays on the App Router means: loading.tsx ((user)/ and admin/(protected)/ already show ScreenLoader), next/link useLinkStatus per link, useTransition pending for own transitions (src/components/Overlays/README.md「Loading」)
why: the three subscribed to Router.events, a Pages Router API that never fires under App Router, so the overlay never appeared. App Router has no global navigation event; a global overlay would need click interception plus useSearchParams (suspends without a boundary, against cacheComponents). A fork file importing a deleted module fails typecheck after this merge
required_actions:
1. git grep -nE "RouteTransitionOverlay|useRouteChangeEffect|useRouteTransitionPending|Overlays/Loading/RouteTransition" -- src → for each hit in a fork-owned file: delete the import and its use (the overlay rendered nothing under App Router, so removing it changes no behavior). If src/app/layout.tsx conflicts on merge, take upstream's lines for these two spots
2. If the fork needs pending feedback for a transition, use loading.tsx of that route, useLinkStatus inside the <Link>, or useTransition around router.push (do not restore Router.events)
3. Leave UI_BEHAVIOR_CONFIG.routeTransitionOverlay in src/config/ui/ui-behavior-config.ts as it is (no longer read; the config restructure is handled separately)
4. pnpm typecheck && pnpm lint
verify: git grep -nE "RouteTransitionOverlay|useRouteChangeEffect|useRouteTransitionPending|from \"next/router\"" -- src prints nothing | pnpm typecheck passes
manual_steps: -
refs: src/app/layout.tsx | src/components/Overlays/README.md「Loading」 | order 20261102-114025-route-transition-overlay-app-router
notes: deleted files (not moved): src/components/Overlays/Loading/RouteTransition.tsx, src/hooks/useRouteChangeEffect.ts, src/hooks/useRouteTransitionPending.ts. Fork callers of the two hooks were 0 at the guild survey; the root layout is the only upstream mount
