# DOWNSTREAM NOTICE id:20261120-173831-flux-rejoin-never-stop
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261106-194813-tooling-ownership-and-growth.2 | commit:- (this commit)
date: 2026-11-20T17:38:31+09:00
severity: info
checkpoint: flux-rejoin-never-stop
change: /flux's Rejoin (incoming.mjs rejoin, patterns.md REJOIN) decides without stopping: lines the fork took in whole are not counted (one line left = the usual order), the line with the most checkpoints goes first also with three or more lines (an octopus or overlapping merges), the same number puts upstream's first-parent line first; rejoin: undecided (stop and ask) is left only for a notice on one line naming one on another
why: /flux stopped at every split and merge of upstream history with three or more lines or the same number of checkpoints, even when the side lines were already taken in
required_actions: none
verify: -
manual_steps: -
refs: .claude/skills/flux/incoming.mjs (rejoin), .claude/skills/flux/patterns.md (REJOIN), .claude/skills/flux/SKILL.md, .claude/skills/flux/incoming.test.mjs
notes: no fork action: /flux reads incoming.mjs, patterns.md and SKILL.md at the upstream's tip
