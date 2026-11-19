---
paths:
  - "src/lib/screens/**"
  - "src/config/app/screens.config.ts"
---
# lib/screens
what: the page-layer structure (page.tsx 1-line switch → _screen/<Name>Screen.tsx + _screen/loader.ts, fork replacements in _components/), its checks (checks.mjs, screens.test.mjs) and the route map src/app/route-map.jsonl (pnpm generate routes) | ScreenProps (@/lib/screens types.ts)
use: always
change: placement = src/config/app/screens.config.ts (FORK_SCAN_EXCLUDES) | add = src/app/**/_components/** (forkScreenParts, extensionPoints.ts)
rules:
using:
- route_map: route-map.jsonl is generated → never hand-edit it | a merge conflict → regenerate with pnpm generate routes and commit
- scan_excludes: folders not to check (labs, demos) → FORK_SCAN_EXCLUDES | no legacy exception list (drop FORK_LEGACY_ROUTES lines after a merge)
- own_checks: a fork's own checks import checks.mjs | no local copy of the screens test
- admin_page: every admin Screen renders AdminPage itself (hide its header through frame.ts)
editing:
- checks_pure: checks.mjs stays free of side effects
read: structure, ownership, layers → Overview | own page, replace an upstream screen, examples → Usage | contracts, guard.ts, loader, Screen, containers → API | checks, generated admin routes, route map → Internals
