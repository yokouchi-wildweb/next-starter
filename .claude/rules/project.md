# project

## ROLE
type: upstream template (base for many forked projects)
direct_users: minimal — this repo itself has few end users
downstream: many derivative projects depend on this as their base

## IMPLICATIONS
- changes propagate to all downstream forks; high blast radius
- favor generality and extensibility over project-specific shortcuts
- preserve extension points; avoid hardcoding for any single use case
- new lib/core API with symmetric variants (plain/diff, single/many, sync/async) → ship the full set at once, never half (no "YAGNI, later" option, don't ask which half)
- new measurement/accumulation feature → ship opt-in (enabled:false) | gate each feature by whose decision it is: separate responsibilities never share a cookie/flag/storage, share vocabulary (param names) only
- cross-cutting capability that needs per-domain wiring → first propose centralizing it in the lib (createCrudService option etc.), not per-domain wrappers
- history rewrite (secret leak etc.) → compute fork impact first (commits to be rewritten) | unpushed → soft reset + squash | pushed → rotate/unblock first | filter-branch/filter-repo over all history = last resort

## TIER (multi-tier hierarchy)
this_repo: Tier1 (canonical upstream). Hierarchy: Tier1 → Tier2 → Tier3.
note: downstream forks maintain their OWN project.md and overwrite this declaration per-fork.
rule: generic/foundational capabilities live HERE (Tier1); downstream must not hardcode them locally — escalate instead.
request_protocol (shared mailbox: ~/.team/orders/ — never under ~/.claude/: Claude Code always prompts for Write/Edit there, allow rules cannot suppress it):
- inbox per receiving repo: ~/.team/orders/<repo-id>/ (+ done/) | skills ship in .claude/skills/{order,inbox,wen}, layout: .claude/skills/order/SKILL.md
- any repo: /order <self|repo> files a one-off order into that repo's inbox (self = own next task) | /wen checks the orders filed in the current session
- any repo: /inbox judges each order against its own role, then does it → RESOLUTION + done/, or relays it to the repo that owns it (any direction: hand off = close, or wait = waiting_on:)
