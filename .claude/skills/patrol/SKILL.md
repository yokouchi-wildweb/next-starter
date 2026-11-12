---
name: patrol
description: Patrol the running app along a check sheet (name.check.md beside an order) with Playwright, write every result back to the sheet and report; ng items become fix orders on the user's go | When the user runs /patrol (or the alias /browser-check), or an inbox order is kind browser-check, or a fix order's check sheet should be re-run
argument-hint: "<指令の id / 指令ファイル / シートのパス (省略で受信箱の browser-check を選ぶ)>"
---

role: **patrol** (see what a check sheet lists in the running app, item by item; record, report, never fix during the run)
app: the server, the login and the cleanup go through `pnpm workflow devcheck run server|login` and `pnpm workflow devcheck cleanup` (scripts/workflow/devcheck/README.md), never started or stopped by hand
alias: /browser-check = this skill (kept for orders and habits) | the order kind stays `browser-check`

sheet: `<order name>.check.md` beside the order (head `check_sheet:` names it) | format = head comment of `.claude/skills/order/checkSheet.mjs` | one item `## C<n>` = page / as / needs / steps / expect / widths + result / evidence / ran_at | screenshots of ng items → `<order name>.check/`
helper: `node .claude/skills/order/mailbox.mjs check <run | result | show>` (run at the repo root; never edit the sheet by hand)
target: $ARGUMENTS

## STEPS
1. **find the sheet**:
   - args = an order id / file → that order in `node .claude/skills/order/mailbox.mjs inbox` | args = a sheet path → that sheet (no order work: skip steps 2 and 9)
   - args empty → the `kind: browser-check` orders of the inbox list | none → say `ブラウザ確認の依頼はありません`; end | several → ask which; STOP
   - the order is taken by someone else / routed to another owner (mailbox.mjs prints the owner) → give the owner; STOP: ask the human
2. **take** (only a `kind: browser-check` order; running this skill is the human's go): `node .claude/skills/order/mailbox.mjs take <order>` | another kind with a `check_sheet:` (a fix order) → its owner already holds it: never take or resolve it
3. **read**: `node .claude/skills/order/mailbox.mjs check show <sheet>` (items, results so far, `shots:` dir) | then `node .claude/skills/order/mailbox.mjs check run <sheet>` (starts a run)
   - Playwright tools (`mcp__playwright__*`) missing in this session → STOP: say so (the run needs them) | release the order if you took it
4. **app** (running this skill is the go for the server and the login it needs):
   - `pnpm workflow devcheck run server` → the URL | exit 3 (a server outside the tool serves this checkout) → use it | exit 4 (policy off), exit 5 (server limit) or any other failure → STOP: report
   - any item with `as: user | admin` → `pnpm workflow devcheck run login` → email / password / loginUrl | `user` = that admin too (an admin reaches (user)/(protected) pages)
   - login stops (no DB, not development, policy off) → items needing a login become `skip` with that reason; guest items still run
5. **run every item**, guest items first (logged out), then log in once at loginUrl and run the rest:
   - per width of `widths:` → `browser_resize` (width × 900) → `browser_navigate` to URL + `page:` → follow `steps:` → judge `expect:`
   - also ng: console errors (`browser_console_messages`, level error) the item does not expect | obvious layout breakage (overflow, overlap, missing parts)
   - `needs:` not in place → `skip` with what is missing | never create data by any means other than the app's own screens, never write the DB directly
   - ok → `node .claude/skills/order/mailbox.mjs check result <sheet> C<n> ok --evidence="<one line seen>"`
   - ng → `browser_take_screenshot` into `<shots>/C<n>-<width>.png` (create the dir) → `check result <sheet> C<n> ng --evidence="<what was seen> | shot:C<n>-<width>.png"`
   - skip → `check result <sheet> C<n> skip --evidence="<reason>"`
   - never edit code during the run, even for an obvious fix
6. **clean up**: `pnpm workflow devcheck cleanup` (stops only the server devcheck started, never one you found running)
7. **look into each ng** (read only): the likely cause in code (label it `推定` unless reproduced), whose it is (this repo | upstream: the code sits in an ancestor's path → upstream), the fix in one line
8. **report** in Japanese:
   ```
   ブラウザ確認: <題>（項目 <n>: ok <a> / ng <b> / skip <c>）
   ng:
   - C<n> <page>（<as>, <width>）: <見たもの> → 推定: <原因> / 直す側: <このリポ | 上流> / 直し方: <1 行>
   skip:
   - C<n>: <理由>
   ```
9. **close the order** (`kind: browser-check` only):
   - no ng → write the body to a temp file and `node .claude/skills/order/mailbox.mjs resolve <order> --status=done --commit=- --pushed=- --body=<file>`:
     ```
     implemented: ran <n> browser checks: ok <a>, ng 0, skip <c>
     consume: -
     propagate: -
     notice: -
     notes: <skip reasons | ->
     ```
   - ng → propose one fix order per cause (this repo → `/order self` (a quest when it fits) | upstream → `/order <upstream>`), each carrying its ng items: after writing it, `node .claude/skills/order/mailbox.mjs check attach <fix order> --sheet=<sheet> --only=C<n>,…` (results cleared, the ng kept in `was:`; re-run later with `/patrol <fix order id>`)
     - STOP: wait for the human's go on the fix orders | on the go → file them (the /order steps), then resolve this order `--status=partial` with the body above (`ng <b>`) and `notes: fix orders <id>, …`
     - the human fixes nothing now and files nothing → still `--status=partial`, notes = the ng items left open
   - a sheet re-run on a fix order → no resolve: the report is the fix owner's evidence for its done_when

reply: Japanese
