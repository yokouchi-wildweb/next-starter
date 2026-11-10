---
name: quest
description: Work one inbox order to a commit on the current branch with no human round trip (read, take, do the work, quick ship without checks or push, draft the answer); the order is answered after the caravan departs (caravan.md) | When a quest Seeker works an order it was handed, or the user says to quest an order (accepted from the start, no approval steps)
argument-hint: "order:<指令 id> [draft:<答えの下書きのパス>]"
---

role: **quest** (work one order exactly as any session would, minus the human round trips: no approval wait, no checks, no push, no answer) | the checks, the push and the answer come once for many orders at the departure (`caravan.md` beside this file)
args: $ARGUMENTS | `order:<id>` = the order | `draft:<path>` = where the answer draft goes (default `$(git rev-parse --git-common-dir)/quest/<id>.resolution.md`: shared by every worktree of the repo, outside the work tree)

## STEPS
1. **read the order**: its file = the path `node .claude/skills/order/mailbox.mjs inbox` lists for the id | read it in full (refs it names when the need is not clear without them)
2. **take it** with no approval wait: `node .claude/skills/order/mailbox.mjs take <the file>` | already taken by you → go on | refused (taken by someone else / routed to another owner) → STOP: report the owner
3. **no acceptance judgment**: a quest is accepted from the start | only when you find it is not this repo's work (another repo's, to be sent back, or stale) → STOP: the reason and the handling you propose (relay to / send back / withdraw) | never relay, release or resolve it yourself
4. **do the work** the way you would do any order in this repo: the project's rules and your own judgment, nothing quest-specific (generators, browser checks, what to propose: as usual)
   - the order's requester must decide something (its intent is unclear, two readings change the result) → STOP: one question, the options and your recommendation (the caller decides how it is asked; never ask the requester yourself)
   - stay on the branch you are on: never switch, rebase, merge or push (the caller prepared the branch)
5. **commit**: `/ship --quick no-push order:<id>` (notice judgment and writing, the commit with `order: <id>`; no checks, no push) | an order with no diff (an investigation) → no ship
6. **draft the answer**: write the RESOLUTION body to the draft path (`mkdir -p` its folder) in the form of `.claude/skills/inbox/SKILL.md` HANDLE step 4b (council orders: `findings:` and `verify:` too; `verify:` says what you ran and that the full checks come at the departure) | never run `mailbox.mjs resolve`: the caravan answers after the push
7. **report** (Japanese): the commit short sha and branch (or `commit なし`), the notice id (or `notice 不要: <理由>`), the downstream intake verdict from the actual diff, `[user-run]` steps of the notice (db:push etc.) or none, findings, the draft path
