# DOWNSTREAM NOTICE id:20261103-090321-lint-hooks-glob-server-paths
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:feature/bundle3-ui-docs-tools | commit:- (this commit)
date: 2026-11-03T09:03:21+09:00
severity: info
checkpoint: lint-hooks-glob-server-paths
resolves: 20261101-124453-lint-hooks-glob-server-paths
change: eslint.config.mjs page-authz rules no longer treat src/features/**/services/server/** as UI: layout-no-server-data and the UI part of session-api-callsite ignore it; core services/server stays under session-api-callsite via its own config block
why: the UI glob src/features/**/hooks/** also matched server code in services/server/**/hooks, so forks renamed server folders only to pass the rule; renaming back is now possible (optional)
required_actions:
1. Optional, only if this fork renamed or moved a server-side folder to dodge page-authz/layout-no-server-data (e.g. oripa-do: src/features/gachaMachine/services/server/draw/drawHooks/): it may rename it back to hooks/ with git mv and update its imports (git grep -n "drawHooks" src). Skip if the fork prefers the current names; nothing breaks either way
verify: pnpm lint passes | pnpm test:page-authz-lint passes
manual_steps: -
refs: eslint.config.mjs (page-authz blocks) | eslint-rules/page-authz.mjs header | eslint-rules/page-authz.test.mjs | order 20261101-124453-lint-hooks-glob-server-paths
notes: measured upstream with ESLint calculateConfigForFile over src: layout-no-server-data loses exactly 1 file (src/features/core/purchaseRequest/services/server/hooks/purchaseCompleteHookRegistry.ts), no UI path lost; session-api-callsite coverage unchanged upstream (core services/server still checked) | fork-owned services/server/**/hooks drop out of session-api-callsite, same as every other fork service (already out of scope by design) | a fork's eslint.config.fork.mjs that re-adds these globs keeps its own behavior
