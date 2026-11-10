role: **caravan** (load the commits quests made onto one line, the caravan; depart it to main once for many orders: the full checks, the push, the safe point, the answers) | read by the quest caravan, or a session the user tells to load / depart quest work
where: a linked worktree on the caravan's own branch | never the main checkout, never its local `main` ref (HQ D176; `git rev-parse --git-dir` differs from `git rev-parse --git-common-dir`, else STOP)
words: load = put an order's commits on the caravan | depart = ship the caravan to main

## CONFLICT RULES (load and depart alike)
- `.notices/shipped/<fork_id>.md` (append-only index) → keep both sides' lines, the line already on the caravan first | never edit a line's text
- generated files (`src/app/route-map.jsonl`, `src/registry/**` written by `pnpm generate registry`, `src/registry/district-map.jsonl`, `extensions/` folders, `vercel.json` crons) → take either side, then rerun its generator (`pnpm generate routes | registry | district-map | extensions | cron`) and add the result
- `pnpm-lock.yaml` → take the caravan's side, then `pnpm install` and add the lockfile it writes
- anything else → read both orders (need / why) and both notices, resolve it so both intents hold | needs a judgment → abort (`git cherry-pick --abort` / `git rebase --abort`); STOP: the question, the options and your recommendation

## LOAD (`load <order id> <branch> [<base>]`)
1. the commits: `git log --reverse --format=%H <base>..<branch>` (base = where the branch was cut; not given → `git merge-base HEAD <branch>`) | none → report `積むものなし` and end
2. `git cherry-pick <commits>` in that order | a conflict → CONFLICT RULES → `git cherry-pick --continue`
3. the lockfile changed in what was loaded → `pnpm install --frozen-lockfile`
4. no checks here (the departure runs them once)
5. it cannot be loaded because the order's own work is broken (not a conflict between two orders) → abort; STOP: report it to go back to its worker with the reason
6. report: the order, the commits now on the caravan (short sha)

## DEPART (`depart`: only on the human's word)
1. note the orders on the caravan: the `order: <id>` lines of `git log --format=%B origin/main..HEAD`
2. `git fetch origin main` → `git rebase origin/main` | a conflict → CONFLICT RULES → `git rebase --continue`
3. `/ship --safe` (ships the commits already made: `.claude/skills/ship/SKILL.md` step 1 COMMITTED RANGE; full checks on the tip, the worktree push route, the safe point tag)
4. a full check failed:
   - find the orders behind it: `git log --format='%h %s' origin/main..HEAD -- <files in the failure>` and their `order:` lines
   - where two orders' work meets (a type both changed, an import one removed) → fix it on the caravan as its own commit (`caravan: <the joint fix>`), back to 3
   - inside one order's own work → drop that order: `git rebase --onto <c>^ <c>` for each of its commits, newest first (an order whose commits stop applying without it goes too) | back to 3 with the rest
   - unclear → STOP: what failed, the orders it may come from, the options
5. the push was refused (main moved meanwhile) → back to 2
6. pushed → answer each departed order:
   - its commit: `git log -1 --format=%h --grep='^order: <id>$' HEAD`
   - its draft: `$(git rev-parse --git-common-dir)/quest/<id>.resolution.md` (or the path the caller gives) | missing → leave the order open, report it
   - `node .claude/skills/order/mailbox.mjs resolve <the order file> --status=done --pushed=yes --commit=<sha> --body=<draft>` (council orders that stopped short: `--status=partial`) | leave the draft: the caller removes it (never `rm` it here)
   - an order with no commit (an investigation) the caller names → the same with `--commit=- --pushed=-`
7. report (Japanese): the safe point tag (or `セーフポイントなし: <理由>`), the departed orders with their sha, the dropped orders with the reason (to go back to their workers), the orders left unanswered and why
