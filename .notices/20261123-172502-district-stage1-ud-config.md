# DOWNSTREAM NOTICE id:20261123-172502-district-stage1-ud-config
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:qc/kagerou/o/20261123-171010-domains-rename-ud-config | commit:- (this commit)
date: 2026-11-23T17:25:02+09:00
severity: action-required
checkpoint: district-stage1-ud-config
fixes: 20261122-180722-district-stage1
pick: -
resolves: 20261123-170928-domains-rename-ud-config
change: .notices/20261122-180722-district-stage1.domains-rename.mjs, during an open merge (MERGE_HEAD), also takes a fork-changed file under src/features, src/config/features or .claude/rules/items/features that is missing from the work tree but present in HEAD and different from the merge base (git's modify/delete, UD, with the old-path copy gone): HEAD's version is "ours" in the same 3-way merge with the new path (no new path → HEAD's version, rewritten, is placed there); a conflict stops as merge-conflict naming `git show HEAD:<old path>`; the old path's unmerged index entry is cleared by the tool's git add -A. The dry-run counts them ("うち木に無い fork の版(HEAD)"). New stop head-only: such a file while the target folder does not exist yet.
why: listFiles skipped paths missing from the work tree, so these files kept the upstream version at the new path and the fork's lines were lost silently (oripa-do: 10 config files, found only by a typecheck error)
required_actions:
1. A fork whose district-stage1 take-in is still open: run the latest upstream tool as district-stage1 required_actions 1 (its sub-line: a temporary copy inside .notices/ from `<upstream remote>/main`) — dry-run, clear the stops, then --apply.
2. A fork that already finished district-stage1: list the upstream config / domain files it had changed before the segment: `git diff --name-only <merge-base of the take-in> <the take-in merge>^1 -- src/features src/config/features .claude/rules/items/features`; for each, check that the fork's lines are in the new path (`git diff <the take-in merge>^1:<old path> HEAD:<new path>` shows only upstream's changes and the path rewrite); a lost line → `git merge-file` with ours = `git show <the take-in merge>^1:<old path>` (rewritten to the new paths), base = `git show <merge-base>:<old path>`, theirs = the new path, and commit.
3. Nothing else changes: phase-rename and the rest of district-stage1 are as before.
verify: step 2's list has no file whose fork lines are missing at the new path; `pnpm typecheck` passes
manual_steps: -
refs: .notices/20261122-180722-district-stage1.domains-rename.mjs (headOnlyForkFiles, planRename, applyRename), .notices/20261122-180722-district-stage1.domains-rename.test.mjs (open UD merge tests), order 20261123-170928-domains-rename-ud-config (oripa-do, relayed as quest 20261123-171010-domains-rename-ud-config)
notes: The case where git leaves the fork's copy in the tree (its usual "Version HEAD ... left in tree") was already merged by the tool; this adds the copy-gone case. With --base after a committed take-in, a fork version lost in that commit is not recovered by the tool (it reads the tree, not <merge>^1): step 2 covers it. The codemod's owner is the district council (council/20261122-061654); only the codemod, its test and this notice changed.
