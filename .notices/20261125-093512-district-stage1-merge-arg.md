# DOWNSTREAM NOTICE id:20261125-093512-district-stage1-merge-arg
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:02e3011ba
date: 2026-11-25T09:35:12+09:00
severity: action-required
checkpoint: district-stage1-merge-arg
fixes: 20261122-180722-district-stage1
pick: -
uses: .notices/20261122-180722-district-stage1.domains-rename.mjs
change: .notices/20261122-180722-district-stage1.domains-rename.mjs gains `--merge <take-in merge commit M>` for a take-in whose merge is already committed (railroad / fleet: merge first, codemods in a later turn): the 3-way base is `git merge-base M^1 M^2`, and a fork-changed file under src/features, src/config/features or .claude/rules/items/features that the committed merge dropped from the old path (git's modify/delete resolved as delete) is read from M^1 (the fork before the take-in) and merged into the new path as during an open merge; a conflict stops as merge-conflict naming `git show <M^1>:<old path>`. During an open merge (MERGE_HEAD) nothing changes. `--base <sha>` stays and now prints one line that it did not look for those files. The district-stage1 body (required_actions 1) now names --merge.
why: with --base after a committed merge the tool read only the tree and HEAD, where those files no longer exist, so it reported 0 fork versions and the fork's lines were lost silently (Polaris: 7 src/config/features value files and 3 generated lists, restored by hand)
required_actions:
1. A fork whose district-stage1 take-in merge is committed and the tool has not run yet: run the latest upstream tool (district-stage1 required_actions 1, its sub-line: a temporary copy inside .notices/ from `<upstream remote>/main`) as `node .notices/tmp-latest.domains-rename.mjs --merge <take-in merge commit>` — dry-run, clear the stops, then the same with --apply.
2. A fork that already ran it with --base (or by hand) after a committed take-in: on its current tree, dry-run the latest upstream tool with `--merge <take-in merge commit>`; each file counted under "fork versions not in the tree" is merged into its new path (a line restored by hand earlier shows as same); clear the stops, then --apply. None counted → nothing to do.
3. A fork whose take-in was an open merge (MERGE_HEAD): nothing to do.
verify: the dry-run with --merge reports 0 stops and, after --apply, the fork's lines of each counted file are in its new path; `pnpm typecheck` passes
manual_steps: -
refs: .notices/20261122-180722-district-stage1.domains-rename.mjs (mergeParents, headOnlyForkFiles, parseArgs), .notices/20261122-180722-district-stage1.domains-rename.test.mjs (committed UD tests), .notices/20261122-180722-district-stage1.md required_actions 1
notes: A fork whose own tree holds the tool from the district-stage1 checkpoint (without --base / --merge) uses the temporary copy of the latest upstream tool. Fork-specific impact: not checked.
