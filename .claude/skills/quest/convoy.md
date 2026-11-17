role: **convoy** (load the commits quests made onto one line, the Convoy's line; depart it to main once for many orders: the checks, the push, the answers; a safe point only as /ship's own rules make one) | read by a caravan party's Convoy, or a session the user tells to load / depart quest work
where: a linked worktree on the Convoy's own branch | never the main checkout, never its local `main` ref (HQ D176; `git rev-parse --git-dir` differs from `git rev-parse --git-common-dir`, else STOP)
words: load = put an order's commits on the Convoy's line | depart = ship the line to main | answer = answer the orders a team tool shipped

## CONFLICT RULES (load and depart alike)
- `.notices/shipped/<repo_id>.md` (append-only index) → keep both sides' lines, the line already on the Convoy's line first | never edit a line's text
- generated files (`src/app/route-map.jsonl`, `src/registry/**` written by `pnpm generate registry`, `src/registry/district-map.jsonl`, `extensions/` folders, `vercel.json` crons) → take either side, then rerun its generator (`pnpm generate routes | registry | district-map | extensions | cron`) and add the result
- `pnpm-lock.yaml` → take the Convoy's line's side, then `pnpm install` and add the lockfile it writes
- anything else → read both orders (need / why) and both notices, resolve it so both intents hold | needs a judgment → abort (`git cherry-pick --abort` / `git rebase --abort`); STOP: the question, the options and your recommendation

## LOAD (`load <order id> <branch> [<base>]`)
1. the commits: `git log --reverse --format=%H <base>..<branch>` (base = where the branch was cut; not given → `git merge-base HEAD <branch>`) | none → report `積むものなし` and end
2. `git cherry-pick <commits>` in that order | a conflict → CONFLICT RULES → `git cherry-pick --continue`
3. the lockfile changed in what was loaded → `pnpm install --frozen-lockfile`
4. no checks here (the departure runs them once)
5. it cannot be loaded because the order's own work is broken (not a conflict between two orders) → abort; STOP: report it to go back to its worker with the reason
6. report: the order, the commits now on the Convoy's line (short sha)

## SEGMENT (`segment <label> notices:<path>`: a council's segment closes on its cue)
1. every order of the segment is loaded already (the caller sends the cue after the loads)
2. `/ship no-push notices:<path>` on the Convoy's line: one notice from the council's draft (every `- ` item, `resolves:` items into `resolves:`), `checkpoint:` = <label>, committed with its index line, not pushed
3. report: the notice id, the draft items it left out (or none) — the caller tells the council

## DEPART (`depart`: only on the human's word)
1. note the orders on the line: the `order: <id>` lines of `git log --format=%B origin/main..HEAD`
2. `git fetch origin main` → `git rebase origin/main` | a conflict → CONFLICT RULES → `git rebase --continue`
3. `/ship` (ships the commits already made: `.claude/skills/ship/SKILL.md` step 1 COMMITTED RANGE; the area checks of what the line carries, the worktree push route)
4. a check failed:
   - find the orders behind it: `git log --format='%h %s' origin/main..HEAD -- <files in the failure>` and their `order:` lines
   - where two orders' work meets (a type both changed, an import one removed) → fix it on the line as its own commit (`convoy: <the joint fix>`), back to 3
   - inside one order's own work → drop that order: `git rebase --onto <c>^ <c>` for each of its commits, newest first (an order whose commits stop applying without it goes too) | back to 3 with the rest
   - unclear → STOP: what failed, the orders it may come from, the options
5. the push was refused (main moved meanwhile) → back to 2
6. pushed → answer each departed order:
   - its commit: `git log -1 --format=%h --grep='^order: <id>$' HEAD`
   - its draft: `$(git rev-parse --git-common-dir)/quest/<id>.resolution.md` (or the path the caller gives) | missing → leave the order open, report it
   - `node .claude/skills/order/mailbox.mjs resolve <the order file> --status=done --pushed=yes --commit=<sha> --body=<draft>` (council orders that stopped short: `--status=partial`) | leave the draft: the caller removes it (never `rm` it here)
   - an order with no commit (an investigation) the caller names → the same with `--commit=- --pushed=-`
   - a draft whose first line is `also_of: <a departed order id> | status:<s> | why:<…>` (the departed order asked for it) → answer that order too, right after:
     - the rest of the draft as `--body`, `--status=<s>`, `--force="<departed order id> の依頼の指示: <why>"` (it is someone else's order)
     - its file already in done/ → leave it | `also_of:` names an order that did not depart → leave it for that order's departure
7. report (Japanese): the departed orders with their sha, the dropped orders with the reason (to go back to their workers), the orders left unanswered and why

## ANSWER (`shipped [nocommit:<id>,…]`: a team tool shipped the line for you, inside one branch with others' work)
1. no /ship, no push, no rebase: the orders are on main already, rebased (new shas, their `order:` lines kept)
2. `git fetch origin main`
3. DEPART 6 for each order the caller names, its commit from main: `git log -1 --format=%h --grep='^order: <id>$' origin/main`
4. DEPART 7's report
