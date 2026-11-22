# DOWNSTREAM NOTICE id:20261123-073356-gate-tests-ship-only
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261111-153718-claude-md-context.2-content | commit:- (this commit)
date: 2026-11-22T22:33:56Z
severity: info
checkpoint: gate-tests-ship-only
fixes: 20261118-044933-v2-checks
pick: -
change: pnpm check proxies runs the gate tests (FEATURE_GATE_CHECK=all pnpm test src/featureGate scripts/structure/proxies) only outside the build phase (env PHASE ≠ build: the ship phase, or called by name); the offline value checks featureRequirements and explicitChildren still stop the build | core/scripts.md phases: build runs no tests (the gate tests of proxies ride ship only); src/featureGate/API.md and the comments of testGate.mjs / featureRequirements.ts follow
why: Vercel's build has no .git and the test runner lists test files with git ls-files, so the build phase stopped there and production deploys failed; forks take the fix with nothing to do
required_actions: none
verify: -
manual_steps: -
refs: scripts/structure/proxies/check.ts | scripts/runner/phases/run.mjs (env PHASE) | scripts/runner/test/scan.mjs listTestFiles | .claude/rules/core/scripts.md phases
notes: a fork whose Vercel build stopped on the gate tests builds again after taking this; the gate tests still stop /ship on a violation
