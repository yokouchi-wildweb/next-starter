# DOWNSTREAM NOTICE id:20261123-112356-quick-ship-generators
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:qc/kagerou/o/20261123-111524-district-map-stale-at-ship | commit:- (this commit)
date: 2026-11-23T11:23:56+09:00
severity: info
checkpoint: quick-ship-generators
resolves: 20261119-111917-district-map-stale-at-ship
change: /ship --quick (QUICK SHIP in .claude/skills/ship/commit.md) now runs `pnpm generate --phase=ship` before step 3 and puts every output it changed into the commit (generators whose watch the range hits; a generator is work, not a check, D357) — a quick commit and a notice checkpoint on it no longer carry a stale generated file (e.g. src/registry/district-map.jsonl after adding a lib config)
why: quick ships skip step 2, so a stale generated output went out until a later plain ship's checks caught it; a fork stopped at a checkpoint in between got it and its check --phase=ship failed (upstream fcd10096a, notice 20261111-132214-lib-close-stage2-a: dbAgent row exists:false)
required_actions: none
verify: in a quick ship that changes a lib config.ts, git show --stat HEAD lists src/registry/district-map.jsonl | pnpm generate district-map leaves no diff after it
manual_steps: -
refs: .claude/skills/ship/commit.md (QUICK SHIP) | scripts/runner/phases/README.md (watch) | order 20261119-111917-district-map-stale-at-ship
notes: on upstream main pnpm generate district-map already leaves no diff and pnpm check district-map (phase ship) already stops a stale map in a plain / safe ship; this closes the quick-ship gap for every generated output | with hotfix, src/app/route-map.jsonl and pnpm-lock.yaml stay out of the commit (git restore them) | your own team tools that commit with /ship --quick get the step from commit.md, nothing to change
