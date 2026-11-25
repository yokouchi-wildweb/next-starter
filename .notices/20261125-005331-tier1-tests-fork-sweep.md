# DOWNSTREAM NOTICE id:20261125-005331-tier1-tests-fork-sweep
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261026-152333-shared-shelf.4r | commit:- (this commit)
date: 2026-11-25T00:53:31Z
severity: info
checkpoint: tier1-tests-fork-sweep
resolves: 20261125-093924-tier1-tests-fork-sweep
change: upstream tests no longer fail in a fork that changed things at declared places | values / gate / closed sets: line.test.ts (LINE default from messagingConfigDef.defaults), labels.test.ts (kind label default from the owner's defaults, presenters against the resolved config), districtMap.test.mjs (frames) and walletOff.test.tsx (closed cron tasks): a fork may add its own | 1-line switches pointed at a fork's .replace: AdminLayout.test.tsx header-look tests and the auth / user / wallet messages.test.ts rendered-text tests run in Tier1 only; the messagingLayouts alert / link / notice / statement / welcome tests read the .default components | new test helper in @/lib/forkOwnership/node: isTier1Repo(repoRoot) and assertUpstreamItems(actual, upstream, { repoRoot, ordered? }) (Tier1 exact, a fork upstream ⊆ actual) | new rule line .claude/rules/core/scripts.md tests fork_values: a test reading the real repo asserts upstream's exact values only in Tier1 (defaults from <owner>ConfigDef.defaults, gate from its current answer, lists upstream ⊆ actual)
why: three safe points of oripa-do / pandora stopped on this class in one day (fork values and fork looks against upstream literals)
required_actions: none
verify: `pnpm test` passes in a fork that opened LINE, relabelled a message kind, added a frame or a wallet-dependent cron, or replaced AdminHeader / a mail layout renderer
manual_steps: -
refs: src/lib/forkOwnership/upstreamItems.mjs | .claude/rules/core/scripts.md tests fork_values | order 20261125-093924-tier1-tests-fork-sweep
notes: a fork with its own tests of the same kind may use isTier1Repo / assertUpstreamItems
