---
name: inbox
description: List, read and handle the one-off orders addressed to this repo (from /order or a council legate, self-addressed ones included) - judge acceptance against this repo's role, and relay what needs another repo's work | When the user asks to see or work this repo's inbox, or names an order id / file
argument-hint: "[指令の id / ファイル名 (省略で一覧)]"
---

role: handle the **ORDERs** addressed to this repo (one-off orders filed by `/order`; a council legate's orders have the same form)
- sender = head of the order's `from:` | repo = origin URL | own repo = self-addressed plan | team role = `<team> <instance> | role:<role name> | repo:…` (fleet Admiral, guild Architect …; the issuer is that team, repo: = the repo it ran in) | council = `council <topic id>` | how they are written: `.claude/skills/order/SKILL.md` step 3
- every order: think whether to accept it against this repo's role before acting

mailbox: `~/.team/orders/` (shared folder; real place = `root:` of `mailbox.mjs self`; outside git; layout explained in `.claude/skills/order/SKILL.md`)
- **own inbox** = `<root>/<own fork-id>/` (fork-id = `fork_id:` of `.claude/rules/project.md`) | place and contents from `node .claude/skills/order/mailbox.mjs inbox` (run at the repo root) | never read other repos' inboxes
- unhandled = `*.md` directly in the inbox | handled = moved to the inbox's `done/`
- **state** (head `status:` of the order, one value; old orders without it = open): `open` = unhandled | `routed` = routed to a council / guild / legate plan (`routed_to:` = owner) | `taken` = the owner started (`taken_by:` = owner) | answers = done / partial / relayed / rejected / withdrawn (moved to `done/`)
  - transitions stay in the order's trailing `## STATUS_LOG` | never edit the state by hand → `mailbox.mjs route | take | release | unroute | resolve`
- **owner guard**:
  - taking = when the human approves the first proposal after reading the order (HANDLE step 3) → record it with `node .claude/skills/order/mailbox.mjs take <order>` | reading, choosing or launching is not taking (quest and guild too)
  - open = anyone may take | routed = only the routed target (otherwise mailbox.mjs prints the owner and refuses)
  - an order taken by someone else / routed to another owner: list it, never work it (relay, send back and withdraw included) | ask the human what to do (leave it to the owner / re-route by the human's call `route --to=` / clean up a stopped session `release --force=<reason>`)
  - resolve is refused for non-owners too (only when the human decides: `--force=<reason>`; the RESOLUTION keeps `forced:`)
- own name = `mailbox.mjs me` (repo session = `<origin> | branch:<b>`, team tab = `<team> <instance> | role:…`) | team tabs are matched to `council <instance>` / `guild:<instance>` routes automatically | routed by name (`guild:<name>`, `legate <id>.<k> plan-SS`) → add `--as=<that name>` to take / release / resolve
- **standard place to work**: start the order's work in one tab (Seeker) by typing `quest <order id>` in a terminal (a normal work session, not a guild)
  - taking: when the human approves the first proposal, the Seeker records it as `quest <instance> | role:Seeker` | a council Chair (Archon included) reaches that tab with `msg --order <order id>`
  - working in a normal session is allowed, but then messages cannot reach it (the lead can only append to the order) | inside a Seeker tab, use this skill's HANDLE mode as is
- unhandled orders with a `waiting_on:` line = this repo asked another repo and waits for the result (RELAY: ask and wait below) | mailbox.mjs prints `waiting` while a target is open, `resumable` when all are handled
- the order's `to:` is not this repo (misdelivered) → do not take it, follow RELAY / SEND BACK / WITHDRAW below
- **orders from a council** = `from: council <topic id> | legate:l<k> order:NN`:
  - one step of a council legate (the council's mechanism that issues orders one at a time and verifies each) that needs work in this repo | the body's `order:` holds the council's order as is
  - handled like a normal order | the differences are written at each place of HANDLE below (stop at the boundary, `output:`, RESOLUTION findings / verify)
  - the council sees the order move to `done/`, takes in the RESOLUTION and verifies it itself | the legate's index and folder are the council's: this session never touches them

target: $ARGUMENTS

## LIST (args empty)
0. this repo is Tier1 (owner of the first section of `src/lib/CATALOG.md`) → put line 1 of `pnpm workflow ownership check` (count of upstream debt rows) as one line at the head of the list (debt = places where upstream points downstream to an edit inside core; orders to build intake points sit in the inbox; src/lib/forkOwnership/README.md `受け口の一覧`) | not Tier1 → nothing
1. get the unhandled orders to this repo with `node .claude/skills/order/mailbox.mjs inbox` (first word of each = `open` / `routed` / `taken` / `waiting` / `resumable`; `routed_to:` / `taken_by:` lines = owner; trailing `(you)` = yourself)
2. list them, using the output's `title:`, `need:`, `from:`:
   - `kind: quest` line = a quest → prefix the title with `クエスト` | quests only → `inbox --quest`
   - **one-line summary (title / id / need / from; old orders without `title:` omit the title)** in Japanese, in 3 sections: **`未対応`** (open / waiting / resumable) | **`振り分け済み → <routed_to>`** (routed; yours → `自分の担当`) | **`着手中 → <taken_by>`** (taken; yourself → `自分が着手中`)
   - from: own repo → `自分宛て` | team role → team and role name, like `fleet の提督から` (mailbox.mjs lists team orders as `from: <team> <instance> <role name>`; never call them self-addressed even if they ran in this repo)
   - `waiting` → add `待ち（<待っている先>）` | `resumable` → add `再開可`
   - sender is a repo other than this one (a downstream fork) → add `下流の一時許可の元かもしれない → 出荷は resolves: 付き` (`.notices/README.md` section `解決(resolves)`; always pass `order:<id>` to the completion /ship)
3. branch on the count (not counted: `waiting`, routed / taken owned by someone else):
   - 0: say `未対応の依頼はありません`
   - **1: do not ask which to start; go straight to HANDLE steps 1-3 for that order** (read in full → summary → implementation proposal; no implementation)
   - 2 or more: ask `どれに着手しますか？`; STOP

## HANDLE (args = an id / file name)
1. read the order file in full | do not take it yet (take = when the human approves the step-3 proposal)
   - already taken by someone else / routed to another owner (owner in the list or at the file head): give the summary and the owner; STOP: ask the human (owner guard above) | no proposal, no work
2. **summarize in Japanese** (need / why / done_when / constraints)
   - `resumable` → also read the RESOLUTION of the `waiting_on:` targets (files moved to `done/`) and include it
   - council orders → also include the body of `order:` (the decisions of this step, done conditions, `まだやらないこと` = not yet)
3. **propose this repo's implementation** (placement by CODE_PLACEMENT, generalization, API design)
   - **first judge acceptance against this repo's role; state the verdict at the top** (council orders too, with the note below)
     - read this repo's project.md (role, TIER, split) and CLAUDE.md | verdict = accept / accept with changes / relay (hand off | ask and wait) / send back / withdraw
     - self-addressed orders are judged the same way (no longer needed or stale after writing → withdraw)
     - criterion ①: is it this repo's? | needs another repo's work first, or better carried on by another repo → relay (upstream, downstream or sibling alike) | should be kept by the sender → send back | steps: RELAY / SEND BACK / WITHDRAW below
     - criterion ②: does it go against this repo's role / policy?
     - criterion ③ (this repo has downstream forks): does it narrow every fork's freedom (data, logic, security boundary = upstream; screens, wording, design = downstream), can it be backed out without a breaking change | core UI returns fine-grained parts and default containers, never a prop for swapping (CLAUDE.md core_ui)
     - an API / implementation idea written by the sender = a proposal to critique, not a spec
     - this repo is Tier1: an existing means passes every check with the same URL and the same result → return that means and close (a per-process copy is not a means) | an order whose premise differs from the current CLAUDE.md → send back (`.claude/rules/core/extensions.md`)
   - **this repo has downstream forks** (`downstream: yes` in `.claude/rules/project.md`; read it like `/ship`, `downstream` of `readForkIdentity` in `src/lib/forkOwnership/forkIds.mjs`; `none` = none; declaration missing / wrong → do not guess, STOP: have it declared) → put the downstream intake verdict (estimate) as one line at the head of the proposal:
     - `取り込み判定（見込み）: 安全 | 要注意（理由）| 危険（理由）`
     - `危険` (danger) = a plain merge breaks the fork's build, boot or existing behavior / needs manual work on the fork side (db:push, env, external resources …) / behavior or permissions change silently | `要注意` (caution) = only as far as merge conflicts may happen
     - a step held with `output: commit` → judge as "when the fork receives it at shipping" | no downstream → omit
   - **diagnose only after reproducing**: trust the symptom, but never treat "the cause is X" as fact until you reproduce it minimally yourself
     - e.g. a claim of a missing route → check with an unauthenticated `curl -i` (401/JSON = reached, 404 text/html = really missing) | a check that needs a running server → give the user the curl and get the result
     - never widen the scope until the premise is solid
   - **judge downstream follow-up** (only when this repo has downstream forks):
     - this change makes the fork's existing code drift from the upstream spec (structure, generators, conventions, API …) → include in the proposal a migration bringing the fork's existing code to the new spec, shipped in `.notices/` in the same commit as the implementation
     - never leave compat behind for forks to sit on; prefer a clean state without drift | the notice holds what changed and markers to find the target code in the fork (grep patterns etc.) | not needed → one word why
   - **council orders**: the content was concluded by the council → judge only whether the implementation is sound
     - a hole in the conclusion itself → never redesign on your own; give `差し戻し（要再審議）` (send back, needs re-deliberation) with the reason
     - also **stop at the order's boundary (`まだやらないこと`)** | problems outside it are not fixed → write them in the RESOLUTION `findings:` at completion (the council's material for the next order)
     - include how the done conditions are checked (commands, tests) in the proposal
   - **no implementation yet**; STOP: wait for the user's approval
   - **approved → record taking before working**: `node .claude/skills/order/mailbox.mjs take <the file>` (not needed when resuming a `resumable` or already taken by yourself; never for an approval of relay / send back / withdraw) | refused (meanwhile taken by someone else / routed to another owner): give the owner; STOP: ask the human | no work
   - after taking, the order is to be parked / left to another session → let it go with `node .claude/skills/order/mailbox.mjs release <the file>`
   - inside a team session (you are the orchestrator) → put this order into plan.md / handoff and run it through the normal team procedure
4. the user says `対応完了` (done) → steps a-d:
   - **the completion report and commit & push always go together** | `対応完了` doubles as the explicit commit / push instruction
   - **run a-d in a row with no confirmation, question or AskUserQuestion to the user in between** | `対応完了` is the only and sufficient approval; waiting for another approval is prohibited
   a. **ship with `/ship`** (before the RESOLUTION, to fix the substance and get an exact commit sha): follow `.claude/skills/ship/SKILL.md` with the argument `order:<order id>` (range, checks, notice judgment and composition, commit, push; it stops only when it hits /ship's section STOP CASES) | a change for which the proposal decided to ship a notice → /ship's judgment follows that
      - an order of checks / investigation only with no diff → no /ship, no commit (RESOLUTION `commit:- | pushed:-`)
      - rejecting (rejected) an order from a downstream fork → write in the RESOLUTION notes what the sender does with its temporary permit (revert / move to the intake point / re-permit under another policy) (the sender's /wen permits shows it) | even a resolution without a diff, when the sender is a downstream fork → ship a resolves: notice per /ship's judgment
      - already committed inside a team procedure → make no new commit, use the current HEAD
      - branch follows the team / normal flow (already on a feature branch → stay; team session → the orchestrator's branch policy)
      - **a council order with `output:` → follow it** (the order's declaration is the explicit push instruction):
        - `push` = as above
        - `commit` = **no push** (/ship with `no-push`) → stack on the branch the order's `held:` names; before working `git switch <branch>` (missing → `git switch -c <branch> <the order's base:>`), commit, then `git switch <main>` back to main (`pushed: no (held)`)
        - `none` = no commit (only write the observed / measured results in the RESOLUTION; `commit:-`)
      - after /ship, get the short sha by `git rev-parse --short HEAD` and the branch by `git rev-parse --abbrev-ref HEAD` | push failed → reflect it honestly in the RESOLUTION `pushed:` (never paper over it)
   b. write the **RESOLUTION body** to a temp file (never inside the repo; e.g. `mktemp`) | the sender consumes it with `/wen` | English, structured | the `resolved:` and `by:` lines are written by the command in c, keep them out of the body:
      ```
      implemented: <what was actually done>
      consume: <how the requester uses it: path + API | ->>
      propagate: <how it reaches the requester | ->
      notice: <.notices/<id>.md — apply with /flux | ->
      notes: <anything the requester needs>
      ```
      - `propagate:` (sender repo = head of from:, for an order from a team role its `repo:`): sender is a downstream fork of this repo = `pushed to origin — fetch & merge upstream into your fork to receive it` | self-addressed = `-` | otherwise = how it reaches the sender (`-` when the sender is unaffected)
      - **council orders**: `status:` = `done | partial` (partial = stopped at part of the order; reason in findings) | always add these 2 lines after `notes:` (the council's main material for verification; Japanese allowed):
      ```
      findings: <作業中に見つけた問題・指令とのずれ・範囲外として残したこと・未確認の点 | none>
      verify: <指令の done_when をどう満たしたか: 実行したコマンド/テストとその結果。確かめていないことは「未確認」と書く>
      ```
   c. **answer** (append the RESOLUTION and move to `done/` in one go; run at the repo root):
      `node .claude/skills/order/mailbox.mjs resolve <the file> --status=done --pushed=<yes | no と理由 | -> --body=<file from b>`
      - fork-id, url, branch, commit of `by:` come from the repo it runs in (commit = the HEAD fixed in a) | no commit → `--commit=-` | committed in another repo → `--commit=<sha and place>` | stopped at part of a council order → `--status=partial`
      - a missing line → nothing is written and it stops (add the line the error names to the body, run again) | refused because the owner differs (someone else's taken / another route target) → never add `--force` yourself; STOP: ask the human
      - the written form:
        ```
        ## RESOLUTION
        resolved: <ISO8601>   status: done
        by: <self fork-id> | <self repo url> | branch:<branch> | commit:<short sha or -> | pushed:<yes|no|->
        implemented: … （本文がそのまま続く）
        ```
   d. report in Japanese:
      - **first line = the downstream intake verdict (measured)**: same form as the estimate, re-judged from the actual diff | changed from the estimate → add why
      - commit sha / pushed branch / RESOLUTION appended and moved to done/ | push failed → say so explicitly
      - council orders: the gist of findings | `output: commit` → the held branch name (not pushed) | and the line below | never run ahead to the next step yourself
        ```
        評議会の議長タブで `check` と打つと結果を取り込んで検証します（議長タブを閉じていれば別ターミナルで `council <議題id>` を実行して再開し、`check`）
        ```

## RELAY / SEND BACK / WITHDRAW (normal orders only; once the user approves the proposal, continue without asking)
- **when to relay**: needs another repo's work first, or better carried on by another repo (upstream, downstream or sibling alike) | pick the target yourself from this repo's role and the target's role (project.md of `rules:` in `node .claude/skills/order/mailbox.mjs repos`)
- **which relay** (state which, with the reason, in the proposal): the original order's `done_when` is met by the target's work alone → **hand off** | this repo has follow-up work after the target's result → **ask and wait**
- **hand off** (closes the original order):
  a. write a new order into the target's inbox based on the original: new id (`date +%Y%m%d-%H%M%S`), `from:` stays the original sender, `to:` rewritten for the target, add the line `relayed_from: <original id> | via:<own fork-id>` after `to:` | other fields as they were (what this repo learned → add to `notes:`)
  b. answer the original: write the body (`relayed_to: <target fork-id>/<new id>.md` and `notes: <why it was judged the target's>`) to a temp file, `node .claude/skills/order/mailbox.mjs resolve <original order> --status=relayed --body=<file>` (writes `by: <self fork-id> | commit:- | pushed:-` and moves it to `done/`)
  c. report in Japanese: the handed-off target and the new order's path
- **ask and wait** (the original stays open):
  a. write a new order into the target's inbox by the steps of `.claude/skills/order/SKILL.md` | `from:` = value of `mailbox.mjs from` (this repo; a team tab → that team) | `need:` = only the part the target should do | `refs:` = the original order's path
  b. append one line `waiting_on: <full path of the new order>` at the end of the original | several targets → more lines | the original stays in the inbox (not moved to `done/`)
  c. report in Japanese: the asked target and the new order's path; the original is listed as waiting | when all targets are handled it shows as `再開可` (resumable) in the list
  d. resuming → HANDLE mode; read the RESOLUTION of the `waiting_on:` targets before proposing | the target sent back / withdrew → re-propose what to do with the original (ask another target / do it here / send it back)
- **send back** (should be kept by the sender, or not a valid order): body `notes: <reason and how the sender should keep it>`, `node .claude/skills/order/mailbox.mjs resolve <original order> --status=rejected --body=<file>` | no commit
- **withdraw** (no longer needed / stale; common for self-addressed plans): body `notes: <reason>`, `node .claude/skills/order/mailbox.mjs resolve <original order> --status=withdrawn --body=<file>` | no commit

reply: Japanese
