# DOWNSTREAM NOTICE id:20261118-040946-base-skills-generic
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261106-194813-tooling-ownership-and-growth.1 | commit:5d108a12e
date: 2026-11-18T04:09:46Z
severity: info
checkpoint: base-skills-generic
change: /ship, /order, /inbox, /wen and .claude/skills/order/mailbox.mjs no longer know the team tools; their hooks are generic: /ship notice:council → notice:defer (no notice written, the material reported for a caller that writes one later); notices:<draft> keeps its name (one draft = one notice); mailbox.mjs inbox --quest → inbox --kind=<value> and kind: takes any value (lowercase, digits, hyphens); /order's quest argument → kind:<value>; env TK_TEAM / TK_INSTANCE / TK_LABEL → ORDER_ACTOR (the issuer and owner name, any one line); TK_FORK_ID_STRICT → ORDER_REPO_ID_STRICT; route --to is an opaque string matched exactly (no council / guild: aliases); resolve no longer asks findings / verify for council orders (the sender checks its own extra lines)
why: these skills are the base every fork shares; tool-specific behaviour belongs to the tools that call them, through arguments and environment variables
required_actions: none
verify: -
manual_steps: -
refs: .claude/skills/ship/SKILL.md, .claude/skills/order/SKILL.md, .claude/skills/order/mailbox.mjs, .claude/skills/inbox/SKILL.md, .claude/skills/wen/SKILL.md
notes: deleted: .claude/skills/quest/SKILL.md, .claude/skills/quest/convoy.md (moved into the local team tools). Segment base-skills-generic of build b1 (council 20261106-194813-tooling-ownership-and-growth). A fork that never edited .claude/skills/quest/ loses it with the merge; nothing to port. The inbox location (~/.team/orders, TEAM_ORDERS) and the name check reading fleet.conf are unchanged here.
