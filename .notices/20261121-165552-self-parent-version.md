# DOWNSTREAM NOTICE id:20261121-165552-self-parent-version
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261111-153718-claude-md-context.2-content | commit:- (this commit)
date: 2026-11-21T07:55:52Z
severity: info
checkpoint: self-parent-version
fixes: 20261119-070827-v2-switch
pick: -
change: pnpm workflow ownership check no longer fails a fork whose self file (behavior.md / repo.json / project.md) equals the parent's version after a take-in: using the parent's version as is is a valid choice and stays silent when the fork already had the parent's version before the take-in; own lines a take-in dropped are listed as `[self-parent-lost]` (self.asks, never a failure) and /flux step 7c asks "親の版に従う / 自分の行を戻す"; self-missing, self-rows and self-overview are unchanged | wording follows: CLAUDE.md CHANGE_TYPES 5 self, core/change.md 5 self, core/design.md self_files, src/lib/forkOwnership/README.md; the shipped notice 20261119-070827-v2-switch step 4 and note (5) now give the two choices
why: the default-on self check of 20261119-070827-v2-switch failed forks that simply follow their parent's behavior.md, a legitimate choice (it could not tell intent from accident)
required_actions: none
verify: `pnpm workflow ownership check` passes on a fork whose behavior.md equals its parent's; a take-in that drops your own lines prints a `self の聞くこと` section instead of failing
manual_steps: -
refs: src/lib/forkOwnership/self.mjs | src/lib/forkOwnership/README.md | .claude/skills/flux/SKILL.md step 7c | .claude/rules/core/change.md 5 self | council 20261111-153718-claude-md-context D280
notes: a fork that restored its own behavior.md / repo.json only to pass the old check may return to the parent's version
