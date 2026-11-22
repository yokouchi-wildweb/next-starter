# DOWNSTREAM NOTICE id:20261122-192740-db-push-check-rename-prompt
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:(this commit)
date: 2026-11-22T19:27:40+09:00
severity: info
checkpoint: db-push-check-rename-prompt
resolves: 20261121-232103-db-push-check-hangs-on-rename-prompt
change: pnpm db:push:check no longer waits forever on drizzle-kit's "created or renamed from another …?" question when stdin is not a TTY (agents, CI, `< /dev/null`): it stops as soon as the question is printed and exits 1, naming the target (`<table>.<column>`, or the table / enum / … name), the rename candidates from the prompt's options, and the lines of .notices/*.md that name it (the rename-or-create answer a notice gives). It never answers the question (read-only stays read-only). With a TTY it behaves as before. Parts: scripts/operations/db/lib.pendingPrompt.ts (parsePendingPrompt / findNoticeAnswers / formatPendingPrompt)
why: the dry run is the one DB command agents and CI may run (push_roundtrip); a DB still holding a column a later schema renames (e.g. message_dispatches.template_content → authored_content) made it hang with no end, blocking every reader of its statements
required_actions: none
verify: pnpm test scripts/operations/db/pendingPrompt.test.ts passes (fake drizzle-kit prompt output); on a DB with a pending rename `pnpm db:push:check < /dev/null` exits 1 within seconds naming it
manual_steps: -
refs: scripts/structure/registry/README.md (db:push:check, 改名の問い)
notes: the decision itself stays with a human: run pnpm db:push on a terminal, pick rename or create, then pnpm db:push:check = 0 | a temporary permit citing the resolved order expires with this notice
