# DOWNSTREAM NOTICE id:20261123-071737-hotfix-pick-relay
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261026-152333-shared-shelf.4r | commit:- (this commit)
date: 2026-11-22T22:17:37Z
severity: info
checkpoint: hotfix-pick-relay
resolves: 20261121-031939-hotfix-pick-relay-judgment
change: /flux relay judgment (forks with downstream) now defines the hotfix pick case: judged once at the pick (after its required_actions / verify, before the follow-up + ledger commit) with P = the original commit's parent, Q = the original commit (Tier1's adding commit; a grandparent notice → the direct Tier's pick commit), A = the fork's pick commit, so the upstream-changed range is the fix's own diff only; the notice's own segment later does not judge it again (the id is in the ledger) | relay-check.mjs gains `--pick <original commit> [--applied-from <A>]` (P / Q resolved by the tool, A = HEAD by default; not combinable with --p / --q)
why: the in-order reference points put the unrelated upstream commits between the fork's base and the fix into P→Q, so relay-check reported overlap on files the pick never touched and a middle tier would judge "relay needed" wrongly
required_actions: none
verify: pnpm test .claude/skills/flux/relay-check.test.mjs
manual_steps: -
refs: .claude/skills/flux/relay.md (RELAY JUDGMENT case "hotfix pick", HOTFIX) | .claude/skills/flux/SKILL.md (HOTFIX execute 3) | .claude/skills/flux/relay-check.mjs | .claude/skills/flux/relay-check.test.mjs | order 20261121-031939-hotfix-pick-relay-judgment
notes: no fork action: /flux reads relay.md and relay-check.mjs from the upstream tip | ledger lines already written stay as they are (a pick judged before this rule keeps its relay: value) | leaf forks are unaffected (no relay judgment)
