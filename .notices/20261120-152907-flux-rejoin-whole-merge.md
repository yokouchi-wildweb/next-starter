# DOWNSTREAM NOTICE id:20261120-152907-flux-rejoin-whole-merge
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261106-194813-tooling-ownership-and-growth.2 | commit:- (this commit)
date: 2026-11-20T15:29:07+09:00
severity: info
checkpoint: flux-rejoin-whole-merge
change: /flux's Rejoin (.claude/skills/flux/incoming.mjs rejoin, patterns.md REJOIN) counts each line's checkpoints over the whole merge: the checkpoints a fork already took in (its ledger, its tree) count for their line, and only what is left is ordered; a fork that took part of the longer line goes on with that line instead of stopping on 「区切りが同じ数」 of what is left
why: after a fork took part of the longer line, counting only the notices left could make both lines equal, so /flux marked the split undecided and stopped at a merge it had decided from the start
required_actions: none
verify: -
manual_steps: -
refs: .claude/skills/flux/incoming.mjs (rejoin), .claude/skills/flux/patterns.md (REJOIN), .claude/skills/flux/incoming.test.mjs
notes: no fork action: /flux reads incoming.mjs and patterns.md at the upstream's tip
