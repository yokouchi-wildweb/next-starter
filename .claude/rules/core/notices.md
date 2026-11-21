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
delivery: three ways to get a change to forks | 1 a new notice: a change forks must follow (required_actions) | 2 editing a shipped notice's body: a description fix, read by every fork that has not taken it in yet (forks read the last version) | 3 a hotfix: urgent on the human's words only, forks take it ahead of the other segments (hotfix)
- choose: forks that already took a notice in and now must act → a new notice with `fixes:`, never only a body edit | a change no fork follows (upstream tools, wording) → no notice
- how it reaches them: no index, the list of notices = the history of .notices/ (history) | /flux reads each body's last version | a segment's point = the commit that adds its notice (a later edit before the push → /ship moves the add onto it, pnpm workflow notices reorder) | hotfixes: the fork's hotfixApply applies them without stopping, upstream never looks at forks (hotfix applying)
resolves (MANDATORY when shipping an order a downstream repo filed): `resolves: <order id>` in the notice (an info notice if nothing else needs one) | a fork's temporary permit expires as core/ownership.md says | /flux lists the `(order: <id>)` rule lines on it and asks whether to remove them
ship (MANDATORY): every commit + push = /ship (its checks = the only run, checks_in_ship; notice, commit, push) | which kind (quick / plain / safe) and when → .claude/skills/ship/SKILL.md | prod deploys need a safe point (safe_point) | /flux = its receiving pair
- fix to a shipped change → delivery (a description fix = edit its body | work forks that took it in must do = a new notice with `fixes: <notice id | commit:sha>`)
safe_point: the tag safe/\<repo_id\>/\<YYYYMMDD\>-\<n\> on a pushed commit where the full checks passed (pnpm test all, check, typecheck, lint, build; /ship --safe: push, then `pnpm workflow notices safePoint check`, then `tag` on the checked commit even if the remote moved meanwhile) = the only periodic full check
- a plain ship runs area checks only, and its report proposes --safe when due (commits and days since the last own tag, `pnpm workflow notices safePoint status`) | a session with no human (a team executor) puts the proposal in its result for its lead
- prod deploys stop unless at a safe point (Tier1: HEAD at its own | a fork: the ledger's last upstream:\<sha\> at the direct parent's, /flux reports where it stands) | emergency → `--allow-unsafe=<reason>` | never add another periodic full-check mechanism | ref: .notices/README.md セーフポイント
checks_in_ship: a check = running the set that judges whether the code is right (tests, lint, typecheck, smoke, golden, pnpm check) | it runs only inside the shipping tools: /ship step 2 | /flux's per-segment checks | the ship command of ~/.team/_bin | never before a ship, never elsewhere (the ship's own checks are the last run)
- not checks (work, not judging): reading state, getting information or making things = read-only git, grep, reading files, pnpm ops … inspect, a trial run that writes nothing, a generator (pnpm generate, pnpm forge with its own forge:pre / forge:post guards and tests = part of making)
- allowed for now: (1) one run of a check tool to get material for the work (reproducing a bug, the new test you are writing) | (2) after a ship failed, rerunning only what failed while fixing it
- running-app checks (/devcheck, /patrol) and checks on a copy (a lagging fork's copy, a segment run-through) only when a plan or the human names them | a DB state read (pnpm db:push:check) is a check of the DB, not of the code
hotfix: a fix the human calls urgent (production broken, or the human says forks must get it first) = /ship hotfix → the notice's hotfix: \<one-line reason\> makes each fork's /flux pick it ahead of the other segments | only on the human's words, never on your own judgment (it cuts into every fork's work)
- shipping: change and notice in one commit, one purpose (no moves / renames / relocations), not a fix of only the tools /flux reads from the upstream tip, no pnpm-lock.yaml or src/app/route-map.jsonl, required_actions assume no later notice | /ship checks the pick (pnpm workflow notices pickCheck when fixes:)
- applying: forks apply it with the upstream tip's hotfixApply, which skips what their tree lacks and reports it, and stops only on a file the fork changed by hand | ref: .notices/README.md 緊急修正(hotfix), .claude/skills/ship/SKILL.md
checkpoint (MANDATORY on every notice): `checkpoint: <label>` = default = a segment boundary the author declares (the fork is consistent there; upstream does not verify intermediate ones, the fork's /flux does) | `checkpoint: -` only when the fork cannot work without the next notice (reason in notes:) | a shipped one that does not build + an unpickable fix → `skip_checkpoint: <id>` in the fix
- point: the segment ends at the commit that adds the notice | before push /ship moves the add to the last unpushed commit that edits its body (pnpm workflow notices reorder, never past the next notice) | `checkpoint_at: <commit>` only on shipped notices whose body was completed later in the same push, written once by Tier1
git_shape: main's first-parent is one line | a unit of work's merge may stay on it (semi-linear) | a merge that took main into a work line never reaches main | the commit that adds a segment's notice sits on the first-parent line, never on a side branch
- catching up with main: a line several build on → main merged into it by the tool that owns the line | a line with one owner → laid again on main with `pnpm workflow notices catchUp` (keeps work merges, drops main-into-work merges; /ship CATCH UP)
- a fork (a middle tier or a leaf) bringing a work line onto its own main: never a fast-forward | one merge whose first parent is the previous main (`git merge --no-ff`), so the line stays one unit on main's first-parent line
- git rerere: a helper the team tools turn on (a conflict solved once is solved again where the same hunk meets) | a file it solved wrongly → `git rerere forget <path>`, solve it yourself | the last guard = the ship's checks
relay: a mid tier's /flux judges per segment by git diff whether each applied upstream notice needs relaying (ledger `relay:none` or a drafted relay notice with covers: ids) | `/flux relay` = only for legacy unjudged ids | /flux's unjudged-relay report ≠ 0 = flux not done (blocker, not a hint) | forgotten → relay in the very next commit before any other work | ref: .notices/README.md
orders: one-off orders between repos, any direction | shared mailbox ~/.local/state/next-starter/orders/ (env ORDER_STATE_DIR; the old ~/.team/orders/ is a link to it) | never under ~/.claude/ (Claude Code always prompts for Write / Edit there, allow rules cannot suppress it)
- inbox per receiving repo: ~/.local/state/next-starter/orders/\<repo_id\>/ (+ done/) | skills .claude/skills/{order,inbox,wen}, layout: .claude/skills/order/SKILL.md
- to: code of a parent (no intake point, a parent's lib, an upstream bug / perf / security fix) → /order \<direct parent\> + a temporary permit | a contract change or gap (CLAUDE.md, a core file, a Tier1 card, a window item of core/design.md authoring) → /order next-starter, straight from any tier | a middle tier's own rule → /order \<that repo\> | self = your own next task
- /order files it | /wen checks the orders filed in this session | /inbox judges each order against the repo's own role, then does it → RESOLUTION + done/, or relays it to the repo that owns it (hand off = close, or wait = waiting_on:)
