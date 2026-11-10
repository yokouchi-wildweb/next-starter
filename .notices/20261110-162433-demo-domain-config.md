# DOWNSTREAM NOTICE id:20261110-162433-demo-domain-config
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261023-175358-config-redesign.1 | commit:- (this commit)
date: 2026-11-10T16:24:33+09:00
severity: breaking
checkpoint: config-demo-domain
moved: src/config/proxies/demo.config.ts -> src/config/features/demo.config.ts; src/proxies/demo/config.ts -> src/features/core/demo/config.ts
change: new table-less core domain src/features/core/demo (alias @/features/demo/<file>; decision D112) holds the demo values in demoConfig = { mode: { enabled, allowedPaths, allowedPrefixes, redirectTo }, session: { maxAgeSeconds }, adminList: { selectionTable } } with the override src/config/features/demo.config.ts | old -> new: proxies demo theme demoConfig.<key> -> demoConfig.mode.<key>; authConfig.session.demoMaxAgeSeconds -> demoConfig.session.maxAgeSeconds (auth reads it through demoSessionMaxAgeSeconds() only while the feature demoLogin is open, else the normal length); userConfig.userListPage.enableSelectionTable.demo -> demoConfig.adminList.selectionTable | the upstream proxies demo theme is gone (D113: upstream has no value-holding proxy theme; forks may add their own) | the proxy item demoMode reads demoConfig.mode and treats demoPages closed like disabled | featureRequirements moved: demo mode.enabled -> demoPages | core/demo is a base folder (in no rule's domains, ASK 5): the rules demoLogin / demoPages / adminDemoUsers still close the same paths | demo code (login service, hook, screens, API, demo user list) moves into core/demo in a later notice
why: a fork's src/config/proxies/demo.config.ts imports the deleted @/proxies/demo/config and fails pnpm typecheck; fork code reading authConfig.session.demoMaxAgeSeconds or enableSelectionTable.demo fails too; values written in the old places are not read any more
required_actions:
1. Merge upstream up to this checkpoint. src/config/proxies/demo.config.ts: delete it (git rm); if it held values, write them into src/config/features/demo.config.ts under mode (`export default { mode: { enabled: true } } satisfies DemoOverride;`, import type from "@/features/demo/config").
2. If src/config/features/auth.config.ts set session.demoMaxAgeSeconds, or src/config/features/user.config.ts set userListPage.enableSelectionTable.demo, move the value to src/config/features/demo.config.ts (session.maxAgeSeconds / adminList.selectionTable) and delete the old key (pnpm typecheck fails on it).
3. [判断] oripa-do: its src/config/proxies/demo.config.ts is empty → delete it, nothing to write. boardgame-site, TriQ, next-vnx, 88-base: no demo override; their old values equal the defaults (600 seconds, selection table off) → nothing to write.
4. Fork code: `git grep -n "proxies/demo\|demoMaxAgeSeconds\|enableSelectionTable.demo" -- src scripts` → read demoConfig from "@/features/demo/config" (mode / session / adminList).
5. `pnpm generate district-map`, `pnpm check config-overrides`, `pnpm check proxies`, `pnpm typecheck`.
verify: git grep -n "proxies/demo\|demoMaxAgeSeconds" -- src prints nothing | pnpm check config-overrides passes (features/demo paired) | demo mode and demo login behave as before
manual_steps: -
refs: src/features/core/demo/README.md, src/proxies/README.md, src/config/proxies/README.md, src/config/README.md, council 20261023-175358-config-redesign decisions D112 D113 L1.47, legate:l1 order 49
notes: the demo rules keep their paths; core/demo is not closable by itself (no tables / generic API) so the always-on proxy item demoMode may read it.
