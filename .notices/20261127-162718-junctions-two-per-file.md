# DOWNSTREAM NOTICE id:20261127-162718-junctions-two-per-file
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:qc/kagerou/o/20261127-162443-junctions-tool-two-per-file | commit:- (this commit)
date: 2026-11-27T16:27:18+09:00
severity: action-required
checkpoint: junctions-two-per-file
fixes: 20261127-152752-junction-registration
pick: -
resolves: 20261127-162430-junctions-tool-two-per-file
change: .notices/20261127-152752-junction-registration.junctions.mjs: when one owner's hand-written drizzle.ts holds two or more junction tables, each move now starts from the text the previous move left (before, every move re-read the original file and the last one overwrote the others, leaving the earlier table statements in the owner's file); all moved statements leave the owner's file and the imports none of them use any more are removed
why: a fork whose owner file had two junctions (oripa-do: prizeItem ToPrizeTag / ToPrizeBadge, userPlayRestriction ToUser / ToGachaMachine) got the tables exported twice (owner file and new entities/<junction>/drizzle.ts) and typecheck TS2308
required_actions:
1. A fork taking the junction-registration segment now (before this one): at that segment run the latest upstream tool instead of the one in its tree, from a temporary copy inside .notices/ (it imports relatively): `git show <upstream remote>/main:.notices/20261127-152752-junction-registration.junctions.mjs > .notices/tmp-latest.junctions.mjs` → `npx tsx --import ./scripts/runner/preload/serverOnly.mjs .notices/tmp-latest.junctions.mjs` (plan), then the same with --write → `rm .notices/tmp-latest.junctions.mjs`; then this segment needs nothing more.
2. A fork that already ran it with --write: for each owner drizzle.ts that held two or more junction tables, find the table statements still left there whose export also exists in the new file: `git grep -n -E 'export const [A-Za-z]+To[A-Za-z]+Table' -- 'src/domains/*/entities/*/drizzle.ts'`, compare with the entities/<junction>/drizzle.ts files the tool wrote; delete the leftover statement from the owner file and drop the imports it alone used, then `pnpm typecheck` (no TS2308).
verify: pnpm typecheck passes (no TS2308 between an owner drizzle.ts and an entities/<junction>/drizzle.ts)
manual_steps: -
refs: .notices/20261127-152752-junction-registration.junctions.mjs (planJunctions, moveStatement), .notices/20261127-152752-junction-registration.junctions.test.mjs (two junctions in one file), order 20261127-162430-junctions-tool-two-per-file (oripa-do, Mesa council council/20261122-174427)
notes: the tool's owner file rewrite is still per junction, but each one starts from the previous result, so the final owner file is the same as one rewrite per file. Only the codemod, its test and this notice changed.
