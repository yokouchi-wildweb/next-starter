# DOWNSTREAM NOTICE id:20261118-041815-base-flux-orders-generic
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261106-194813-tooling-ownership-and-growth.1 | commit:728ed707f
date: 2026-11-18T04:18:15Z
severity: action-required
checkpoint: base-flux-orders-generic
change: (1) /flux drops the railroad modes (intake / apply), its attached railroad.md and the fleet wording; it takes one hook instead, the argument steps:<path> = a caller's steps file read first and followed (where it says nothing, /flux holds; the file says where the ledger, the checks and the push happen). (2) The order mailbox moves from ~/.team/orders/ to ~/.local/state/next-starter/orders/ (env ORDER_STATE_DIR overrides, $XDG_STATE_HOME is honoured); the new mailbox.mjs moves an old ~/.team/orders/ there on its first run and leaves a link at the old place (order ids and file names unchanged); TEAM_ORDERS is no longer read. (3) mailbox.mjs name-check and pnpm workflow notices hotfixCheck read a repos list file (`<name> <path>` lines) from --repos-file=<path> or env DOWNSTREAM_REPOS_FILE instead of ~/.team/fleet.conf; hotfixCheck --fleet-conf → --repos-file
why: /flux, /order and the notice checks are the base every fork shares; tool-specific modes and files belong to the tools that call them
required_actions:
1. Merge upstream.
2. In .claude/rules/project.md, find the request_protocol block (grep: `\.team/orders`). Replace `~/.team/orders/` with `~/.local/state/next-starter/orders/` in every hit.
3. Grep the fork for other references (`grep -rn "\.team/orders\|TEAM_ORDERS\|fleet-conf" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.notices .`) and change them to the new place / ORDER_STATE_DIR / --repos-file.
4. A tool or script of this fork that runs `/flux intake …` or `/flux apply J<k>`: pass its own steps file instead (`/flux steps:<path> …`); /flux no longer has those modes.
verify: `node .claude/skills/order/mailbox.mjs self` prints `root:` = ~/.local/state/next-starter/orders (or ORDER_STATE_DIR) | `grep -n "\.team/orders" .claude/rules/project.md` has no hits
manual_steps: -
refs: .claude/skills/flux/SKILL.md, .claude/skills/order/mailbox.mjs (ordersRoot, settleRoot, name-check), .claude/skills/order/SKILL.md, scripts/workflow/notices/hotfixCheck.mjs, .claude/rules/project.md
notes: deleted: .claude/skills/flux/railroad.md (moved into the local team tools). Segment base-flux-orders-generic of build b1 (council 20261106-194813-tooling-ownership-and-growth). The mailbox move is per machine and happens once, by whichever repo's new mailbox.mjs runs first; older mailbox.mjs copies keep working through the link at ~/.team/orders.
