# DOWNSTREAM NOTICE id:20261024-140000-orders-mailbox-rename
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-24T14:00:00+09:00
severity: action-required
checkpoint: orders-mailbox-rename
change: The shared mailbox folder is renamed from ~/.team/upstream-requests/ to ~/.team/orders/ (same layout: <repo-id>/ + <repo-id>/done/). The /order, /inbox and /wen skills and mailbox.mjs now point at ~/.team/orders/ (env override renamed TEAM_UPSTREAM_REQUESTS → TEAM_ORDERS). Root-level legacy tickets (no `to:`) are no longer listed by `mailbox.mjs inbox`; they move into the Tier1 (next-starter) inbox on the machine.
why: the folder now carries one-off orders to any repo, not only upstream requests. The project.md request_protocol block of each fork still names the old folder.
required_actions:
1. Merge upstream.
2. In .claude/rules/project.md, find the request_protocol block (grep: `upstream-requests`). Replace `~/.team/upstream-requests/` with `~/.team/orders/` in every hit.
3. Grep the fork for other references (`grep -rn "upstream-requests\|TEAM_UPSTREAM_REQUESTS" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.notices .`) and change them to `~/.team/orders/` / `TEAM_ORDERS`.
verify: `node .claude/skills/order/mailbox.mjs self` prints `root:` = ~/.team/orders | `grep -n "upstream-requests" .claude/rules/project.md` has no hits
manual_steps: The folder move is per machine and done once, outside any repo, by the person who runs the team tools (~/.team): move ~/.team/upstream-requests/ to ~/.team/orders/, move its root-level *.md into ~/.team/orders/yokouchi-wildweb--next-starter/ and root done/*.md into that inbox's done/, leave a symlink ~/.team/upstream-requests → ~/.team/orders until every fork has merged this notice, and update the council's EDICT_ROOT and the Envoy settings that still name the old folder.
refs: .claude/skills/order/mailbox.mjs (ROOT), .claude/skills/order/SKILL.md, .claude/skills/inbox/SKILL.md, .claude/skills/wen/SKILL.md, .claude/skills/fork-init/project.template.md
notes: Forks need no file move of their own; the mailbox is shared on the machine. | Council edict / legate bundles still sit at the mailbox root until the council moves them into its own folder. | Fork-specific impact: not checked.
