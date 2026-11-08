# DOWNSTREAM NOTICE id:20261108-151026-order-quest-kind-resolve-hook
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-08T15:10:26+09:00
severity: info
checkpoint: order-quest-kind-resolve-hook
change: orders get an optional head field kind: quest (written by /order <dest> quest; the quest mark's only source, no title prefix); mailbox.mjs inbox shows a "kind: quest" line and inbox --quest lists quests only; mailbox.mjs resolve calls the executable in env ORDER_RESOLVED_HOOK with the answered order's done/ path when it is set (nothing when unset)
why: a quest was marked only by a title convention, and the requester's lead heard of the answer only when the issuer asked for a report; the flag and the hook let the local team tools list quests and notify the requesting lead
required_actions: none
verify: -
manual_steps: -
refs: .claude/skills/order/mailbox.mjs (isQuest, afterResolve) | .claude/skills/order/SKILL.md | .claude/skills/inbox/SKILL.md
notes: Orders without kind: are unchanged. The hook is unset by default (forks see no behavior change); the local team tools set it in quest tabs only
