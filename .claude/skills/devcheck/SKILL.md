---
name: devcheck
description: Check the current change in the running app and the development tools before calling it done - pick the checks from pnpm workflow devcheck plan, show them as short bullets, take one go, run them all, clean up last and report once | When a change needs checking beyond unit tests (the running app, a login, test data, an env value) or the user asks to check the change
argument-hint: "[確かめたいこと(省略で変更の中身から選ぶ)]"
---

role: check the change of this session with `pnpm workflow devcheck plan|run|cleanup` and Playwright MCP, after one go
source_of_truth: kinds, commands, policy, fork items, exit codes, DEVCHECK_CONTEXT = scripts/workflow/devcheck/README.md | the processing stays in the command
args: $ARGUMENTS
out_of_scope: a check sheet of an order (`<order>.check.md`) → /patrol | the schema push (pnpm db:push) and anything on production are never a check

## STEPS
1. **facts**: `pnpm workflow devcheck plan` | exit 2 → tell the user its one line; STOP
   - read: policy per kind (`自動` / `別に確認` / `手で`), fork items, context (`単体` = take a go | approval=auto = no go), state (server, live servers / limit, admin)
2. **pick** from the candidates what this change needs (the args, else the diff of this session): only what proves the change works
   - kinds: server · browser · login · db-write · db-delete · env-add · test · check · fork items | cleanup is always the last bullet
   - `手で` (off) items stay in the list as the user's part, never run by you
3. **ask once** (skip when the context says approval=auto):
   ```
   確かめ（go で全部やります）:
   - <種類>: <何を・どこで>
   - …
   - 片付け: 立てたサーバーを止め、作った行を消す
   手で: <off の項目 | なし>
   ```
   STOP: wait for go | a changed list → show it again and wait
4. **run** in the listed order, each with `pnpm workflow devcheck run <name> [args]`:
   - server → use the printed URL | exit 3 = a server outside the tool serves this checkout → use it | login → its email / password / loginUrl, log in with Playwright
   - browser → Playwright MCP (navigate, act, read the page, console errors); never create data except through the app's screens
   - db-write → one `INSERT INTO <table> … RETURNING <column>` (test data in development only; user / setting rows through the app's screens)
   - env-add → the value on stdin, never printed or echoed
   - `別に確認` (manual) items → ask for that item alone, then add `--manual-go`
   - exit 4 (policy) → that item becomes `手で` | exit 5 (server limit) → report it, go on with what does not need the server
5. **continue without asking** only inside the go: the listed kinds whose policy is `自動`, the same server and the same development DB, deleting what this plan created
   - STOP and ask again for: an off kind, another environment or connection, deleting data this plan did not create, sending anything outside, any step not in the list
6. **cleanup**: `pnpm workflow devcheck cleanup` always, also after a failure | exit 1 → report what was left
7. **report** once:
   ```
   確かめ: <対象>（<n> 項目: ok <a> / ng <b> / 手で <c>）
   - <種類>: <結果、見たもの 1 行>
   残した行: <画面から作った行 | なし>
   片付け: <止めた・消した物>
   ```
   STOP: fixes happen only on the user's word
