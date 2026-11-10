# DOWNSTREAM NOTICE id:20261110-170633-browser-check-sheets
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-10T17:06:33+09:00
severity: info
checkpoint: browser-check-sheets
change: orders may carry a browser check sheet (<order>.check.md beside the order, ng screenshots in <order>.check/) — mailbox.mjs `check add / file / attach / run / result / show`, `/order <repo> check`, new skill /browser-check (runs the sheet in the running app with Playwright, writes results back, ng → fix orders on the user's go); inbox lists skip sheets and `resolve` moves a sheet to done/ with its order
why: checks that need the running app (from a team run, a fix, a review) can be handed to a repo as an order and run later without a hand-written instruction; forks receive the skill and the mailbox change by the merge
required_actions: none
verify: node --test .claude/skills/order/mailbox.test.mjs passes
manual_steps: -
refs: .claude/skills/order/checkSheet.mjs (sheet format, head comment), .claude/skills/order/mailbox.mjs (check subcommands), .claude/skills/order/SKILL.md (BROWSER CHECK ORDER), .claude/skills/browser-check/SKILL.md, .claude/skills/inbox/SKILL.md
notes: /browser-check needs the Playwright MCP tools in the session and a development DB for login items (pnpm workflow dev-admin run); without a DB the login items are recorded as skip; team tools (~/.team/_bin) list inbox orders with the same rule (sheets are not orders)
