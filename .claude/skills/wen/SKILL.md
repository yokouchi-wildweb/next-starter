---
name: wen
description: Check whether the orders this session filed with /order are done ("wen?"), by reading the inbox files, and report their state; done ones are shown with their RESOLUTION | When the user asks whether an order filed earlier in this session has been handled, or (permits) to review the orders behind this fork's temporary permits
argument-hint: "[指令の id / ファイルパス(省略でこのセッションで起票したもの全部)| permits(自分の一時許可の依頼をまとめて)]"
---

role: check whether **orders you filed in this session** are done
target: $ARGUMENTS

## TARGET
- args empty: collect every order path `/order` wrote in this conversation (the full path given in its filing report) | none → end with one line, the text below:
  ```
  このセッションで起票した指令はありません(別のセッションで出したものは `/wen <id か パス>` で確かめられます)
  ```
- args `permits`: every id in the `upreq:` of each line of your temporary permits (`.fork-ownership/<fork-id>.permits.txt`, fork-id by the same rule as /flux) (PERMITS below)
- args given: that one id or path | id only → look for `<id>.md` in `*/` and `*/done/` of the mailbox root (`root:` of `node .claude/skills/order/mailbox.mjs self`)

## STATE (per order)
- a file at the filed path → **not handled** (`まだ…`) | give recipient and need in one line, plus the class from the head `status:` (old orders without it = open):
  - `open`: nobody has picked it up yet
  - `routed`: `振り分け済み → <routed_to:>` (routed) (council / guild / legate plan; add `routed_at:`)
  - `taken`: `着手中 → <taken_by:>` (in progress) (add `taken_at:`) | an earlier taker existed → add one line from the trailing `## STATUS_LOG`
- at `done/<same name>` beside the filed path → **handled** | Read the body and show the RESOLUTION:
  - `status: done`: summarize implemented / consume / notes | `pushed: no` → add `宛先がまだ push していない` (the recipient has not pushed yet)
  - `status: relayed`: the recipient handed it to another repo | check the `relayed_to:` target (`<root>/<relayed_to>`) the same way and show both states
  - `status: rejected`: sent back | show the reason in `notes:` and how your repo keeps it
  - `status: withdrawn`: withdrawn (a self-addressed plan no longer needed) | show the reason in `notes:`
- in neither place → say `見つからない(手で移動・削除された可能性)` (not found, possibly moved or deleted by hand)
- the recipient is waiting (the original order has `waiting_on:`) → treat as not handled, and add what it waits on

## PERMITS (args `permits`)
- a temporary permit of the ownership check = a line that holds until the order to the direct parent is settled (`src/lib/forkOwnership/README.md`, section `一時許可`) | makes neglect visible (D14: no explicit deadline, listed on every check)
- no permit file / no lines → end with one line `一時許可はありません` (no temporary permits)
- per line, check each id at `*/<id>.md` and `*/done/<id>.md` of the mailbox root, classify as in STATE, plus:
  - handled (done): has the parent's notice brought `resolves:` (`git grep -n "^resolves:.*<id>" <upstream>/<branch> -- .notices`; not merged yet → `取り込めば失効` (merging it expires the permit)) | a line whose ids are all resolved → ask to move it to the intake point or revert it
  - rejected: one of "revert / move to the intake point / re-permit under another policy" is **required** (never leave the line as is)
  - not found: the mailbox is not local (another machine / an organization's parent) → say `確かめられない` (cannot verify; never treat as passed)
- last, add one line with the permit state from `pnpm workflow ownership check` (refresh / expired-*, leftovers)

reply: Japanese
