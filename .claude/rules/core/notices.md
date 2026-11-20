---
paths:
  - ".notices/**"
  - ".claude/skills/ship/**"
  - ".claude/skills/flux/**"
  - "scripts/workflow/notices/**"
  - ".claude/skills/order/**"
  - ".claude/skills/inbox/**"
  - ".claude/skills/wen/**"
---
# notices
> **ROLE**: loaded when writing a downstream notice or the ship / flux / order / inbox / wen tools | holds REPO_LINK detail
> Tier1-owned: forks never edit (gap → /order next-starter)

loop: upstream ships with /ship (a notice when downstream must follow) → downstream takes it in with /flux, segment by segment
- then: /flux is recommended, runs the ownership check, and a mid tier relays → what is missing goes out as /order \<to\> → the receiver judges and answers with /inbox, the sender checks with /wen → the notice that ships the order carries resolves: and the temporary permit and the provisional rule end
notice: an upstream change that needs downstream follow-up ships .notices/\<id\>.md in the same commit (MANDATORY also for deleting / moving a file forks may extend: moved: or the deletion in notes:) | ledger: .notices/applied/\<repo_id\>.md, each line records upstream:\<sha\> | ref: .notices/README.md
- fields: the notice's keys (severity, checkpoint, change, why, required_actions, verify, manual_steps, notes …) = .notices/README.md API | fork follow-up commands go in required_actions
- tools: a notice's migration / codemod (uses:) ships in the notice's commit → run it on your own DB → delete the tool and attachments in the next commit, never folded into the first (core/scripts.md migrations, .notices/README.md)
- keys: renaming / moving / removing a key of CLAUDE.md, a core file or a card → old key → new place in that notice
- history: the shipped notices = the files added to .notices/ in the history (merges and renames included; no index) | fields and text = each body's last version (in the tree, else the version before its deletion) | owner = the body's from: | pick: = a field of the body, written by /ship | a body may be deleted once its segment closed
resolves (MANDATORY when shipping an order a downstream repo filed): `resolves: <order id>` in the notice (an info notice if nothing else needs one) | a fork's temporary permit expires as core/ownership.md says | /flux lists the `(order: <id>)` rule lines on it and asks whether to remove them
ship (MANDATORY): every commit + push = /ship (checks, notice, commit, push) | which kind (quick / plain / safe) and when → .claude/skills/ship/SKILL.md | prod deploys need a safe point (safe_point) | /flux = its receiving pair
- fix to a shipped change: a description fix → edit its body (forks read the last version) | work forks that took it in must do → a new notice with `fixes: <notice id | commit:sha>`
safe_point: the tag safe/\<repo_id\>/\<YYYYMMDD\>-\<n\> on a pushed tip where the full checks passed (pnpm test all, check, typecheck, lint, build; /ship --safe, `pnpm workflow notices safePoint check` then `tag`) = the only periodic full check
- a plain ship runs area checks only, and its report proposes --safe when due (commits and days since the last own tag, `pnpm workflow notices safePoint status`)
- prod deploys stop unless at a safe point (Tier1: HEAD at its own | a fork: the ledger's last upstream:\<sha\> at the direct parent's, /flux reports where it stands) | emergency → `--allow-unsafe=<reason>` | never add another periodic full-check mechanism | ref: .notices/README.md セーフポイント
hotfix: a fix the human calls urgent (production broken, or the human says forks must get it first) = /ship hotfix → the notice's hotfix: \<one-line reason\> makes each fork's /flux pick it ahead of the other segments | only on the human's words, never on your own judgment (it cuts into every fork's work)
- shipping: change and notice in one commit, no pnpm-lock.yaml or src/app/route-map.jsonl, required_actions assume no later notice | /ship checks the pick (pnpm workflow notices pickCheck when fixes:) and lagging forks' prerequisites (pnpm workflow notices hotfixCheck) | ref: .notices/README.md 緊急修正(hotfix), .claude/skills/ship/SKILL.md
checkpoint (MANDATORY on every notice): `checkpoint: <label>` = default = a segment boundary the author declares (the fork is consistent there; upstream does not verify intermediate ones, the fork's /flux does) | `checkpoint: -` only when the fork cannot work without the next notice (reason in notes:) | a shipped one that does not build + an unpickable fix → `skip_checkpoint: <id>` in the fix
- point: the segment ends at the commit that adds the notice | before push /ship moves the add to the last unpushed commit that edits its body (pnpm workflow notices reorder, never past the next notice) | `checkpoint_at: <commit>` only on shipped notices whose body was completed later in the same push, written once by Tier1
relay: a mid tier's /flux judges per segment by git diff whether each applied upstream notice needs relaying (ledger `relay:none` or a drafted relay notice with covers: ids) | `/flux relay` = only for legacy unjudged ids | /flux's unjudged-relay report ≠ 0 = flux not done (blocker, not a hint) | forgotten → relay in the very next commit before any other work | ref: .notices/README.md
orders: one-off orders between repos, any direction | shared mailbox ~/.local/state/next-starter/orders/ (env ORDER_STATE_DIR; the old ~/.team/orders/ is a link to it) | never under ~/.claude/ (Claude Code always prompts for Write / Edit there, allow rules cannot suppress it)
- inbox per receiving repo: ~/.local/state/next-starter/orders/\<repo_id\>/ (+ done/) | skills .claude/skills/{order,inbox,wen}, layout: .claude/skills/order/SKILL.md
- to: code of a parent (no intake point, a parent's lib, an upstream bug / perf / security fix) → /order \<direct parent\> + a temporary permit | a contract change or gap (CLAUDE.md, a core file, a Tier1 card, a window item of core/design.md authoring) → /order next-starter, straight from any tier | a middle tier's own rule → /order \<that repo\> | self = your own next task
- /order files it | /wen checks the orders filed in this session | /inbox judges each order against the repo's own role, then does it → RESOLUTION + done/, or relays it to the repo that owns it (hand off = close, or wait = waiting_on:)
