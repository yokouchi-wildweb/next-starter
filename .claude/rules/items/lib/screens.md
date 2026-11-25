---
paths:
  - "src/lib/screens/**"
  - "src/config/lib/screens.config.ts"
---
# lib/screens
what: the page-layer structure (page.tsx 1-line switch → _screen/<Name>Screen.tsx + _screen/loader.ts, fork replacements in _components/), its checks (checks.mjs; the repo-wide test scripts/structure/routes/screens.test.mjs) and the route map src/app/route-map.jsonl (pnpm generate routes)
  - closed lib: "." @/lib/screens (createScreenMaker — screens read the bound createScreen from @/wiring/screen —, ScreenProps, screensConfig) and "./node" src/lib/screens/node.mjs (checks, route tree, route map for tools)
use: always
change: counterpart = src/config/lib/screens.config.ts (forkScanExcludes) | add = src/app/**/_components/** (forkScreenParts, extensionPoints.ts)
rules:
using:
- route_map: route-map.jsonl is generated → never hand-edit it | a merge conflict → regenerate with pnpm generate routes and commit
- scan_excludes: folders not to check (labs, demos) → forkScanExcludes | no legacy exception list (drop FORK_LEGACY_ROUTES lines after a merge)
- own_checks: a fork's own checks import the "./node" entry (src/lib/screens/node.mjs) | no local copy of the screens test
- admin_page: every admin Screen renders AdminPage itself (hide its header through frame.ts)
editing:
- checks_pure: checks.mjs stays free of side effects
read: structure, ownership, layers → Overview | own page, replace an upstream screen, examples → Usage | contracts, guard.ts, loader, Screen, containers → API | checks, generated admin routes, route map → Internals
