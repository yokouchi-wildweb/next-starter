# DOWNSTREAM NOTICE id:20261126-172219-approval-not-window
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261111-153718-claude-md-context.2-content | commit:- (this commit)
date: 2026-11-26T17:22:19+09:00
severity: action-required
checkpoint: approval-not-window
change: the window ends: an important contract change (the list in core/design.md authoring, unchanged: a CLAUDE.md item or section added or a key removed / renamed, a core file added / removed / renamed or its paths widened, a new card category, a check or MANDATORY rule binding forks, a clash between rules of different owners) is approved by the human before it is made, in any Tier1 session or council, with no inbox step | from a fork (any tier): /order next-starter straight, the Tier1 that takes it gets the approval and makes it | CLAUDE.md WRITING, words, orders to:, design_check, core/notices.md orders and core/receptacles.md order say approval item instead of the window
why: the window made decisions already approved by the human in a Tier1 council go through a second approval; a fork's own lines that name the window now point at nothing
required_actions:
1. key table: core/design.md authoring window -> core/design.md authoring approval | CLAUDE.md THIS_FILE words window -> CLAUDE.md THIS_FILE words approval item
2. find your own lines naming the window (provisional rules ending `(order: <id>)`, lines marked `(priority)`, your own rule files) and rewrite each to approval / approval item or drop it: `git grep -n -i -E "the window|window item" -- .claude/rules ':!.claude/rules/core' ':!.claude/rules/items' CLAUDE.local.md` | nothing printed → nothing to do
verify: the git grep of step 2 prints nothing | `pnpm check rules` passes
manual_steps: -
refs: .claude/rules/core/design.md authoring approval; CLAUDE.md THIS_FILE words, REPO_LINK orders, CHANGE_TYPES design_check; .claude/rules/core/notices.md orders; .claude/rules/core/receptacles.md
notes: key table also in required_actions 1 | how a fork files to next-starter is unchanged (/order next-starter, a temporary permit or provisional rule meanwhile) | time windows, window.location and tmux windows are other words and stay
