# DOWNSTREAM NOTICE id:20261110-164152-fork-providers-test-replace
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:quest/riddle | commit:- (this commit)
date: 2026-11-10T16:41:52+09:00
severity: info
checkpoint: fork-providers-test-replace
fixes: 20261109-162006-shared-shelf-override-declarations
resolves: 20261110-132349-fork-providers-test-replace-switch
change: src/app/_providers/ForkProviders.test.tsx only. The switch test accepts a one-statement re-export of ./ForkProviders.default or ./ForkProviders.replace in every tier (Tier1 additionally requires .default, judged by readForkIdentity().isTier1). The pass-through test renders ./ForkProviders.default directly instead of going through the switch, so a fork's .replace may render anything.
why: step 1 of notice 20261109-162006-shared-shelf-override-declarations points a fork's switch at ./ForkProviders.replace, but the test pinned the target to .default, so every fork that followed the notice failed pnpm test src/app/_providers
required_actions: none
verify: pnpm test src/app/_providers passes (with the switch pointing at ./ForkProviders.replace too)
manual_steps: -
refs: src/app/_providers/ForkProviders.test.tsx, notice 20261109-162006-shared-shelf-override-declarations, order 20261110-132349-fork-providers-test-replace-switch
notes: no db:push. Forks that took the test as is get the upstream version on merge; a fork that edited the test locally to pass may return it to upstream's text.
