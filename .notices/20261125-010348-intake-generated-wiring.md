# DOWNSTREAM NOTICE id:20261125-010348-intake-generated-wiring
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261026-152333-shared-shelf.4r | commit:- (this commit)
date: 2026-11-25T01:03:48Z
severity: info
checkpoint: intake-generated-wiring
resolves: 20261125-095708-intake-generated-startup-wiring
change: the intake generated rows (src/lib/forkOwnership/intake.txt, from scripts/structure/extensions/phase.json outputs) now name every knot file the extensions generator writes: src/wiring/backends.ts, cron.ts, googleTag.ts, pageGuard.ts, routeFactory.ts, startup.ts (with dbAgent, formSuite, serverErrorReport) | new upstream tests (Tier1 only): scripts/structure/extensions/outputs.test.mjs (the generator's writes vs its outputs) and scripts/runner/phases/generatedMarks.test.mjs (every generated-marked file is in some generator's outputs)
why: a fork whose plugs/startupTasks item (or another wired point's item) regenerated src/wiring/startup.ts failed pnpm workflow ownership check (outside intake), which stopped its /flux (oripa-do)
required_actions: none
verify: `pnpm workflow ownership check` passes after `pnpm generate extensions` with your own startupTasks item
manual_steps: -
refs: scripts/structure/extensions/phase.json (outputs) | src/lib/forkOwnership/intake.txt (generated block) | order 20261125-095708-intake-generated-startup-wiring
notes: no fork action; the rows arrive with the merge (the generated block is rewritten by pnpm generate extensions)
