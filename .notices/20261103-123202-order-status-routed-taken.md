# DOWNSTREAM NOTICE id:20261103-123202-order-status-routed-taken
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-03T12:32:02+09:00
severity: info
checkpoint: order-status-routed-taken
change: order mailbox skills: an order's status is one value (open | routed | taken | done | partial | relayed | rejected | withdrawn). mailbox.mjs gains route / take / release / me; resolve refuses an order taken by someone else or routed elsewhere unless --force=<reason> (written as forced: in RESOLUTION); inbox lists the state, routed_to / taken_by and (you). Transitions are appended to a `## STATUS_LOG` block in the order file. /inbox takes an order before working on it, /wen shows routed_to / taken_by, /ship stops on an order:<id> held by someone else
why: orders routed to a council / guild / legate plan had no record of it, so another session's /inbox could take and ship them meanwhile. The skills are upstream-owned (.claude/skills/), so forks receive them by merge; no fork code depends on the old shape
required_actions: none
verify: pnpm test:order-mailbox passes | node .claude/skills/order/mailbox.mjs inbox lists every open order with its state word (orders without status: show as open)
manual_steps: -
refs: .claude/skills/order/mailbox.mjs (routeOrder / takeOrder / releaseOrder / resolveOrder guard) | .claude/skills/inbox/SKILL.md「担当の守り」 | .claude/skills/wen/SKILL.md | .claude/skills/ship/SKILL.md step 0 | order 20261103-122539-order-status-routed-taken
notes: existing order files (open and done/) are untouched and stay readable. If a fork edited these skill files, take upstream's text on merge (skills are not a fork intake point). The team tools (~/.team/_bin) calling route / take come in a separate change
