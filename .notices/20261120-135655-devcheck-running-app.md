# DOWNSTREAM NOTICE id:20261120-135655-devcheck-running-app
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261106-194813-tooling-ownership-and-growth.2 | commit:- (this commit)
date: 2026-11-20T13:56:55+09:00
severity: action-required
checkpoint: devcheck-running-app
change: /devcheck no longer has the kinds test and check: it checks the running app and the development tools only (server, browser, login, db-write, db-delete, env-add, fork items); `pnpm workflow devcheck run test|check` is gone and a fork item of kind test / check, or whose command is pnpm test / check / typecheck / lint, is refused
why: checks (tests, lint, types, pnpm check) run only inside a ship tool (/ship step 2, /flux's segment checks; D357, CLAUDE.md checks_in_ship); devcheck offered them as kinds and became a second place to run the same checks before shipping
required_actions:
1. List your own devcheck items that are now refused: `git grep -l -E '"kind": *"(test|check)"|"command": *"pnpm +(-s +)?(test|check|typecheck|lint)( |")' -- scripts/workflow/devcheck/items/` (no output → nothing to do).
2. Delete each file it lists (`git rm <file>`): the check it ran belongs to /ship. An item that does something else as well (seed data, a login) → keep it with a remaining kind (db-write, login …) and a command that is not a check.
verify: `pnpm workflow devcheck plan` shows no `断った fork の項目` line for your items and no test / check candidate | `pnpm test scripts/workflow/devcheck` passes
manual_steps: -
refs: scripts/workflow/devcheck/lib.kinds.mjs (KINDS, HOOK_COMMANDS), scripts/workflow/devcheck/README.md, scripts/workflow/devcheck/items/README.md, .claude/skills/devcheck/SKILL.md
notes: The permission of the plain commands stays: `pnpm test …` (not --db) and `pnpm check …` are still allowed by the policy keys agent.test / agent.check (switch names ts / ck, /allow and /repo-policy as before), now hook-only kinds like agent.peer, so /ship step 2 does not stop for a permission. `pnpm workflow devcheck plan`'s 方針 line now lists peer / test / check too. Your repo.json keys agent.test / agent.check need no change.
