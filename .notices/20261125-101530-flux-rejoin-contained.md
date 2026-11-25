# DOWNSTREAM NOTICE id:20261125-101530-flux-rejoin-contained
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:2d46f58e0
date: 2026-11-25T10:15:30+09:00
severity: info
checkpoint: flux-rejoin-contained
change: /flux .claude/skills/flux/incoming.mjs, Rejoin pattern: when the line placed first had merged another upstream line on the way (a junction merge on upstream's first-parent line, so that line's checkpoints sit below the joining merge's base and count on neither side), those checkpoints are now placed right before the first segment whose target holds them, each as its own segment in history order. Before, they stayed after the reordered block, so a fork taking the block in got them through an earlier segment's merge and /flux then listed them as in the tree but not in the ledger (segment 0). The Rejoin decision itself (the line with more checkpoints first, the others in the joining merge, undecided when a notice names another line's) is unchanged; .claude/skills/flux/patterns.md REJOIN has the line.
why: Polaris (boardlist) took k1..k5 first; k5's target held 7 notices of another line (checks-wording … git-shape-fork) that the plan listed after the block
required_actions: none
verify: -
manual_steps: -
refs: .claude/skills/flux/incoming.mjs (rejoin), .claude/skills/flux/incoming.test.mjs, .claude/skills/flux/patterns.md REJOIN
notes: /flux runs incoming.mjs from the upstream tip, so the fork needs no step. A fork that already took such a block in sees those notices in segment 0 and records them there as usual. Fork-specific impact: not checked.
