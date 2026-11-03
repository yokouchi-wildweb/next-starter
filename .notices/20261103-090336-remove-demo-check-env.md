# DOWNSTREAM NOTICE id:20261103-090336-remove-demo-check-env
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:feature/bundle3-ui-docs-tools | commit:(this commit)
date: 2026-11-03T09:03:36+09:00
severity: action-required
checkpoint: remove-demo-check-env
resolves: 20261030-141229-remove-demo-check-env
change: the /demo/check-env demo page and its API are deleted (they rendered Firebase env values and the service account key); the demo category "dev" (its only item) is removed from DemoCategoryKey / DEMO_CATEGORIES
why: showing secrets on a screen is harmful even to admins; env diagnosis belongs to CLI scripts. Fork links to the page or fork demos in category "dev" stop working
required_actions:
1. `git grep -n "demo/check-env" -- src ':!src/app/route-map.jsonl'` → remove every link / reference to /demo/check-env (no replacement page).
2. `git grep -n 'category: "dev"' -- "src/app/(user)/demo"` → move each fork demo to another DemoCategoryKey (form / overlay / ui / media / auth / payment). If none fits, /order next-starter for a category (DemoCategoryKey is upstream-owned).
3. If the fork edited files inside src/app/(user)/demo/check-env/, those edits go away with the folder: do not restore it (env checks → a CLI script under scripts/).
4. pnpm extensions:generate, then pnpm routes:map (both regenerate the demo index and the route map without the page).
verify: pnpm typecheck | pnpm extensions:check | pnpm routes:map --check | git grep -n "check-env\|buildEnvSummary" -- src prints nothing
manual_steps: -
refs: order 20261030-141229-remove-demo-check-env | src/app/(user)/demo/_data/demoPages.ts
notes: deleted: src/app/(user)/demo/check-env/page.tsx, src/app/(user)/demo/check-env/_screen/DemoCheckEnvScreen.tsx, src/app/(user)/demo/check-env/_screen/loader.ts, src/app/(user)/demo/check-env/api/route.ts, src/app/(user)/demo/check-env/api/envSummary.ts (buildEnvSummary, no other user), src/app/(user)/demo/check-env/ClientApiResult.tsx, src/app/(user)/demo/check-env/_demo.ts. Checked forks (88-base, TriQ, next-vnx, boardgame-site, oripa-do, pandora): no demo other than check-env uses category "dev"; voranowa not checked.
