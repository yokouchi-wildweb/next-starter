# DOWNSTREAM NOTICE id:20261103-103553-tsconfig-drop-baseurl
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:feature/bundle3-ui-docs-tools | commit:- (this commit)
date: 2026-11-03T10:35:53+09:00
severity: action-required
checkpoint: tsconfig-drop-baseurl
resolves: 20261029-221452-upstream-fix-src-imports-tsconfig
change: tsconfig.json no longer sets compilerOptions.baseUrl (TypeScript deprecates it). paths are unchanged and already relative ("./src/*" etc.), resolved from the tsconfig directory. Upstream code has no "src/…" imports left (removed earlier in b5a0d116, 2bf158d8); only @/… and relative imports resolve now
why: a bare "src/…" import only resolved through baseUrl; fork-owned files that still use it fail pnpm typecheck / pnpm build after this merge
required_actions:
1. On merge, take upstream tsconfig.json as is. If the fork had edited tsconfig.json to drop baseUrl itself (and rewritten upstream files for it), revert those edits to upstream's text: tsconfig.json is not a fork intake point
2. git grep -nE "(from|import\()\s*['\"]src/" -- src scripts → rewrite every hit to the @/ alias: "src/<path>" → "@/<path minus src/>" (core domains: "src/features/core/<x>/…" → "@/features/<x>/…" when tsconfig paths has that alias, else "@/features/core/<x>/…"). userLoginEvent has no alias: use "@/features/core/userLoginEvent/…" (do not add an alias to tsconfig.json). Repeat the grep until it prints nothing
3. If .fork-ownership/<fork_id>.permits.txt has rows with upreq:20261029-221452-upstream-fix-src-imports-tsconfig, delete those rows (this notice resolves the order) and revert the permitted edits to upstream's text
4. pnpm typecheck && pnpm lint
verify: git grep -nE "(from|import\()\s*['\"]src/" -- src scripts prints nothing | grep -c baseUrl tsconfig.json prints 0 | pnpm typecheck passes | pnpm build passes | pnpm ownership:check passes
manual_steps: -
refs: tsconfig.json | order 20261029-221452-upstream-fix-src-imports-tsconfig | commits b5a0d116, 2bf158d8 (upstream's own "src/…" imports removed)
notes: measured on fork HEADs before this merge (src + scripts "src/…" import lines): 88-base 26, TriQ 26, next-vnx 26, oripa-demo 16, __voranowa 13, oripa-do-2 6, boardgame-site 0, oripa-do 0, pandora 0; part of each count is upstream files that this merge (b5a0d116, 2bf158d8) already fixes, so grep after the merge. eslint-rules/resolve-import.mjs still maps "src/…" for its guards (default ".") so a leftover import is still classified by the lint rules
