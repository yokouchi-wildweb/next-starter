---
name: patrol
description: Patrol the running app along a check sheet (name.check.md beside an order) with Playwright, write every result back to the sheet and report; ng items become fix orders on the user's go | When the user runs /patrol (or the alias /browser-check), or an inbox order is kind browser-check, or a fix order's check sheet should be re-run
argument-hint: "<指令の id / 指令ファイル / シートのパス (省略で受信箱の browser-check を選ぶ)>"
---

role: **patrol** (see what a check sheet lists in the running app, item by item; record and report) | fixes come after the human's go on the fix orders (step 9), so the run records what it sees
app: the server, the login and the cleanup go through `pnpm workflow devcheck run server|login` and `pnpm workflow devcheck cleanup` (scripts/workflow/devcheck/README.md): start it through pnpm workflow devcheck run so the cleanup tracks it | one you start yourself, you stop yourself
alias: /browser-check = this skill (kept for orders and habits) | the order kind stays `browser-check`

sheet: `<order name>.check.md` beside the order (head `check_sheet:` names it) | format = head comment of `.claude/skills/order/checkSheet.mjs` | one item `## C<n>` = page / as / needs / steps / expect / widths + result / evidence / ran_at | screenshots of ng items → `<order name>.check/`
helper: `node .claude/skills/order/mailbox.mjs check <run | result | show>` (run at the repo root; a hand edit of the sheet keeps the form `check result` writes and is read back with `check show`)
target: $ARGUMENTS

## STEPS
1. **find the sheet**: decide which sheet to run from the args and the inbox (`node .claude/skills/order/mailbox.mjs inbox`: kind, owner, `check_sheet:`)
   - cues: an order id / file names its order and sheet | a sheet path is a sheet alone (no order work) | empty args point at the `kind: browser-check` orders
   - the human decides when it is not clear which one (several, none) or the order has another owner (mailbox.mjs prints it): say what you found and ask; STOP
2. **take** a `kind: browser-check` order you run (running this skill is the human's go): `node .claude/skills/order/mailbox.mjs take <order>` | a fix order's sheet (another kind with `check_sheet:`) belongs to that order's owner, who takes and resolves it
3. **read**: `node .claude/skills/order/mailbox.mjs check show <sheet>` (items, results so far, `shots:` dir) | then `node .claude/skills/order/mailbox.mjs check run <sheet>` (starts a run)
   - Playwright tools (`mcp__playwright__*`) missing in this session → say so; run the items by hand with the human, or in a session that has them (release the order if you took it and stop here)
4. **app** (running this skill is the go for the server and the login it needs):
   - `pnpm workflow devcheck run server` → the URL | a line `この道具の外で開発サーバーが動いています` (a server outside the tool serves this checkout) → use it
   - exit 4 (policy off: the human's decision) → STOP: report | another failure → give its line and cause; items that need the server become `skip` with it
   - any item with `as: user | admin` → `pnpm workflow devcheck run login` → email / password / loginUrl | `user` = that admin too (an admin reaches (user)/(protected) pages)
   - login stops (no DB, not development, policy off) → items needing a login become `skip` with that reason; guest items still run
5. **run every item**, guest items first (logged out), then log in once at loginUrl and run the rest:
   - per width of `widths:` → `browser_resize` (width × 900) → `browser_navigate` to URL + `page:` → follow `steps:` → judge `expect:`
   - also ng: console errors (`browser_console_messages`, level error) the item does not expect | obvious layout breakage (overflow, overlap, missing parts)
   - `needs:` not in place → `skip` with what is missing | data: through the app's screens by default; a row the screens cannot make → `pnpm workflow devcheck run db-write` (development, cleaned up)
   - ok → `node .claude/skills/order/mailbox.mjs check result <sheet> C<n> ok --evidence="<one line seen>"`
   - ng → `browser_take_screenshot` into `<shots>/C<n>-<width>.png` (create the dir) → `check result <sheet> C<n> ng --evidence="<what was seen> | shot:C<n>-<width>.png"`
   - skip → `check result <sheet> C<n> skip --evidence="<reason>"`
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
9. **close the order** (`kind: browser-check` only; a sheet re-run on a fix order is not closed here: the report is that owner's evidence)
   - cues: ng or not | per ng cause, who fixes it (this repo → `/order self`, a quest when it fits | upstream → `/order <upstream>`) | the human's go on those fix orders
   - tools: `node .claude/skills/order/mailbox.mjs resolve <order> --status=<done|partial> --commit=- --pushed=- --body=<file>` | `mailbox.mjs check attach <fix order> --sheet=<sheet> --only=C<n>,…` (the ng items carried, `was:` kept; re-run with `/patrol <fix order id>`)
   - body (a temp file): `implemented: ran <n> browser checks: ok <a>, ng <b>, skip <c>` | `consume: -` | `propagate: -` | `notice: -` | `notes: <skip reasons, fix orders, ng left open | ->`
   - all ok → done | ng → propose one fix order per cause; STOP: wait for the human's go, then file them (the /order steps), attach the ng items and resolve partial (notes: the fix order ids) | no fix order now → partial, the ng left open in notes

reply: Japanese
