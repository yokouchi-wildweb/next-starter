# DOWNSTREAM NOTICE id:20261122-211722-district-stage1-base-arg
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-22T21:17:22+09:00
severity: action-required
checkpoint: district-stage1-base-arg
fixes: 20261122-180722-district-stage1
pick: -
resolves: 20261122-211347-urgent-domains-rename-base-arg
change: .notices/20261122-180722-district-stage1.domains-rename.mjs takes --base <sha> (also --base=<sha>): the take-in's merge base used for the 3-way merge of a file present at both the old and the new path when the take-in merge is already committed (no MERGE_HEAD). During an open merge MERGE_HEAD still wins and --base is ignored (no change for forks that run it mid-merge). A --base that is not a commit stops with exit 2. phase-rename does not read the merge state and is unchanged.
why: mergeBaseReader read only MERGE_HEAD, so a take-in that commits the merge first and runs the codemods after got no merge base and turned every both-exist / fork-changed file into a manual stop.
required_actions:
1. If the district-stage1 take-in merge is still open (MERGE_HEAD exists): nothing new; run the tool as the district-stage1 notice says.
2. If the take-in merge is already committed (M = that merge commit, e.g. `git log --merges -1 --format=%H`): node .notices/20261122-180722-district-stage1.domains-rename.mjs --base $(git merge-base M^1 M^2) (dry-run; both-exist stops become 3-way merges, real conflicts stay merge-conflict stops), clear the remaining stops by hand, then the same command with --apply.
3. Go on with district-stage1 required_actions steps 3-7 (phase-rename, district-kind readers, regeneration, key table, wording) and commit.
verify: node .notices/20261122-180722-district-stage1.domains-rename.mjs --base $(git merge-base M^1 M^2) reports no both-exist stop for files that only one side changed; pnpm test .notices/20261122-180722-district-stage1.domains-rename.test.mjs passes; git ls-files src/features src/config/features .claude/rules/items/features prints nothing (except what district-stage1 step 2 kept)
manual_steps: -
refs: .notices/20261122-180722-district-stage1.md (required_actions 1 now names the --base form), .notices/20261122-180722-district-stage1.domains-rename.mjs (mergeBaseReader, resolveBase, parseArgs), order 20261122-211347-urgent-domains-rename-base-arg (oripa-do, relayed as quest 20261122-211440-urgent-domains-rename-base-arg)
notes: The district-stage1 notice body was edited in the same commit (step 1: the --base form) for forks that have not taken it in yet. The codemod's owner is the district council (council/20261122-061654); only the codemod, its test and the notices changed.
