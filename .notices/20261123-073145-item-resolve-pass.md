# DOWNSTREAM NOTICE id:20261123-073145-item-resolve-pass
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261106-194813-tooling-ownership-and-growth.2 | commit:ad28572c5
date: 2026-11-22T22:31:45Z
severity: info
checkpoint: item-resolve-pass
change: devcheck fork items are no longer rejected for --env / --confirm / db:push text, and order resolve no longer refuses a RESOLUTION body with missing lines or no --pushed (written as given, pushed defaults to -)
why: both stops named nothing they protect (D433 (3), D437): production stays guarded at the write entry (scripts/runner/guard confirmProduction: non-interactive = repo.json policy + the human's one-time permit), dev db:push is not stopped by policy (D420 (3)), and the resolve stop only made agents rewrite answers (25+3 stops recorded)
required_actions: none
verify: pnpm test scripts/workflow/devcheck .claude/skills/order
manual_steps: -
refs: scripts/workflow/devcheck/lib.ts (scanItems), scripts/workflow/devcheck/README.md, scripts/workflow/devcheck/items/README.md, .claude/skills/order/mailbox.mjs (resolveOrder), .claude/skills/inbox/SKILL.md step c
notes: still rejected for devcheck items: the item kind's go, shell operators, check commands (D357), commands that are not this repo's entries. Still refused on resolve: the owner guard (taken / routed, --force=<reason>), done/, a second RESOLUTION, an unknown status. A fork that kept its own devcheck items out because of the old text rule may add them now: git grep -n -E -- '--env|--confirm|db:push' scripts/workflow/devcheck/items
