# DOWNSTREAM NOTICE id:20261103-144217-notice-shipped-index
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-03T14:42:17+09:00
severity: action-required
checkpoint: notice-shipped-index
change: notices get a permanent shipped index .notices/shipped/<fork_id>.md (1 line per notice, append-only, written by /ship); /flux, ownership:check and test:notices read the index + history, so notice bodies can later be deleted without changing any judgement; new notice fields uses: and skip_checkpoint:, pick: moves to the index line
why: notice bodies will be removed once their segment has closed (not in this push); every reader must already use the index before that. A fork that has shipped its own notices fails the new test:notices ("a body without an index line") until it builds its own index
required_actions:
1. Check whether this repo has shipped notices of its own: `git grep -l "^from: $(git remote get-url origin)" -- '.notices/*.md' '.notices/done/*.md'`. Empty → nothing to do for this step (the upstream index .notices/shipped/next-starter.md arrives with the merge; never edit it).
2. If step 1 listed files (e.g. a middle tier such as oripa-do): run `node scripts/notices/shippedIndex.mjs backfill`. It writes .notices/shipped/<your fork_id>.md with one line per notice of your own, in history order, and skips every notice already on a parent's index. Commit the new file with this segment. Do not hand-edit any line of any index.
3. From now on /ship adds the line for each notice you ship (`node scripts/notices/shippedIndex.mjs add <notice>`, already in .claude/skills/ship/SKILL.md). Do not move notices to .notices/done/ any more (the two existing done/ notices stay as they are).
4. A middle tier: your downstream receives your index file with your next push; no relay notice is needed for this notice beyond the usual relay judgement.
verify: `pnpm test:notices` passes (includes the index checks: append-only, one line per body with matching fields, uses:, skip_checkpoint:); `node scripts/notices/shippedIndex.mjs verify` prints a match; `pnpm ownership:check` passes as before
manual_steps: -
refs: .notices/README.md (出荷索引と本文の読み方 / 使う移行・codemod の欄 / 区切りを外す欄 / 本文と添付物の片付け) | scripts/notices/shippedIndex.mjs | .claude/skills/flux/incoming.mjs | src/lib/forkOwnership/check.mjs | .claude/skills/ship/SKILL.md | .claude/skills/flux/SKILL.md | council 20261023-175358-scripts-rules
notes: no notice body is deleted in this push. /flux reads its procedure from the upstream tip, so the new discovery tool (incoming.mjs, run from the tip with git show) applies from the next /flux even before this segment is merged; when the upstream tip has no index it falls back to the old reading. Forks checked for step 1: oripa-do has own notices (from: its origin); 88-base, triq, next-vnx, boardgame-site have none (checked with the grep above on their trees). pandora gets oripa-do's index through oripa-do. Also included: notices:hotfix-check resolves relative refs (HEAD) in the calling repo and lays each fork's ledger picked: on its merge-base (upstream tool only, nothing to do downstream)
