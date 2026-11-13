# railroad (attached to /flux: the modes `intake` and `apply`)
role: inside the railroad team tool, the segment cycle splits into jobs run at the same time: the Tracklayer merges segments ahead (`intake`), Gangers apply the follow-up of one chunk each (`apply J<k>`), the Yardmaster joins the chunks at the junction, the Inspector checks it
- the ledger, the full checks and the push happen at the junction and on the human's `depart` (JUNCTION below), never in these modes
read: before running `/flux intake …` or the cue `apply J<k>` / `fix J<k>` | every rule of SKILL.md holds unless this file says otherwise | the tool's own rules (cues, status, tickets) = the runtime header and the team's protocol

## WHEN
- only inside railroad: the runtime header names `railroad:` and your record paths | run alone (no header) → say these modes need the railroad tool; STOP
- FOLLOW UPSTREAM'S LATEST STEPS applies: read this file as upstream's version too (`git show <upstream>/<branch>:.claude/skills/flux/railroad.md`)

## BRANCHES AND WORKTREES (local only)
- `rr2/<line>/track` = the Tracklayer's branch: intake commits only | `rr2/<line>/J<k>` = one chunk's branch, made by the tool (at the track's intake commit of the chunk's last segment, or at the junction for an `order: after` chunk) | `rr2/<line>/depot` = the junction (`合流地点`), the Yardmaster's
- each tab works in its own worktree (the header's `worktree:`) | never check out a branch another tab is on | never push any `rr2/` branch (preview deploys, CI) | never commit to main
- main moves only on the human's `depart` (the railroad command: the freight train to main, push) | the fork's other work may land on main meanwhile: the Yardmaster merges main into the junction

## INTAKE (`/flux intake [<n> | all] [to <position>]`, the Tracklayer)
what changes from FULL FLOW:
1. recon (step 1) and the overview (step 2) as usual | the next plan = merge only: per segment the conflict forecast (CONFLICT FORECAST), the areas its upstream diff touches (top folders / domains) and whether users see the change (ux) | written in the header's plan file in the tool's form | no application plan, no 6 points, no approval wording of SKILL.md (the tool sends `go`)
2. width = the speed in the header's speed file (`各停` 1 / `快速` 5 / `特急` 10 / `直通` all), read before each plan | HEAVY SEGMENTS and LIGHT SEGMENTS do not apply (the weight is the Pathfinder's lookahead)
3. merge (step 5): a (lineage-touch, side-commit check), b, d (out-of-segment check) and e unchanged | c (conflicts): resolve the obvious ones yourself (upstream intent + the fork's edit)
   - a conflict needing judgment → never pick a side silently | propose the way you think best, with the other options, and stop (state question)
   - one option you may propose = provisional (`仮線`): take one side now, save the other side's hunks as a patch, the Ganger of the chunk holding that segment ports it
   - the patch: `<provisional_dir>/<checkpoint>.<n>.diff` + a 1-line intent in `<checkpoint>.<n>.md` (PROVISIONAL below)
   - `moved:` porting (moved.md) = application work: save the diff as moved.md step 2 says into `<provisional_dir>/`, do not port
   - an ancestor's shipped index `.notices/shipped/<ancestor>.md` → the upstream side, as SKILL.md step 5c says (a row a hotfix pick added by hand drops; the check accepts it)
4. segment 0 (in-tree unapplied notices, nothing to merge) → `git commit --allow-empty`, so every notice has its intake commit
5. never merge main into the track: it carries the upstream's segments only
6. skip steps 6-7 (no application, no checks beyond the merge's own, no ledger, no ownership check, no push)
7. intake commit message: `railroad intake: <checkpoint label>` + blank line + `downstream-notice: <id>` per notice of the segment (history order) + `upstream: <merge target full sha>` | the tool reads these lines (chunks, ledger): never reword them
8. stop only at: a side-commit / lineage-touch / out-of-segment stop, a conflict needing judgment, the end point, the upstream tip | report what was laid (checkpoint labels), provisional patches (count), the areas touched — in the status / plan files the header names; chat = 1-3 lines
- state is derived from history (intake commits on the track) | rerunning continues after the last intake commit

## APPLY (cue `apply J<k>`, a Ganger: one chunk = a run of laid segments #a-#b)
1. `railroad job start <instance> J<k>`: the worktree switches to the chunk's branch (pnpm install when the lockfile changed) | the sheet prints the range, each segment's notices, the human's decisions, the Pathfinder's reading, the provisional patches of the range
2. scope = every notice of the range, whole fork (no area split) + the provisional patches of the range
3. do step 6 (execute: sweep and follow-up) for that scope once, against the state of the chunk's last segment: intermediate states are skipped, a later notice of the range that rewrites the same spot wins
   - REVIEW OF FORK EDITS IN UPSTREAM-OWNED PATHS applies | provisional patches → port them, delete the patch file when ported | `moved:` porting (moved.md) is yours
   - a wide chunk may be split into subagents; you alone commit and write the record
4. checks on what you changed: `pnpm typecheck`, `pnpm exec eslint <changed files>`, the notices' `verify:`
   - after the commit, `railroad job check <instance> J<k>` runs the junction's checks (check --gate=ship, typecheck, eslint, ownership check) on the junction's head + your branch in a throwaway worktree
   - a failure your chunk causes is yours to fix before done (a stale generated file such as the route map is typical) | never merge the junction into your branch
5. data: none here | the dev DB stays at main's schema while the line runs (every DB step runs after the departure) | never run db:push / a migration | a backfill / migration a notice asks for → a `db:` line in the record | a check that needs the new schema → say so in `notes:` instead of running it
6. keep only the 3 allowed kinds (`order:` / `human:` / `migration:`), same as "segment done" | a judgment you cannot make → state question with the options and your recommendation; the Director asks the human
7. commit on the chunk's branch → `job check` passes → write the record (RECORDS) → `railroad job done <instance> J<k>` (checks the form and the check) | relay judgment (a fork with tier root / middle, relay.md RELAY JUDGMENT): every notice of the range, in the record
- nothing to do in the range (the merge alone is enough) → record with `result:none`, no commit, `job done` at once; do not search for work
- cue `fix J<m>` = the chunk came back (the Yardmaster could not join it, or the Inspector found it unsafe): `job start - J<m>` (same branch), read the file the sheet names for why it came back, fix on the branch, commit, write the record for J<m> (same form, only the lines for what you changed now), `job check`, `job done`

## RECORDS (fixed forms; the tool and the Yardmaster read them, so never reshape them)
- Ganger record `<records_dir>/J<k>.md`: first line `# GANGER RECORD job:J<k> ganger:<tab> range:#<a>-#<b> commit:<branch head sha> result:<done|none> submitted:<ISO8601>`
  - one line per notice of the range, history order: `- notice:<id> | aligned:<what moved in the fork> | why:<why it had to, in the fork's terms> | kept_old:<… | order:<id> | -> | notes:<deviations | ->`
  - `why:` thick enough that the Yardmaster can resolve a conflict with another chunk from the record alone
  - then `open: <item> | order:<id>` (or `| human:<reason>` / `| migration:<id>`; 0 or more), `db: <notice id>: <step>` (0 or more), `screens: <route or screen users see change>` (0 or more; the Inspector reads them), `relay: <notice id>: <none | relay notice id>` (a fork with tier root / middle: every notice of the range)
- provisional patch: `<provisional_dir>/<checkpoint>.<n>.diff` + `.md` (one line: `file: <path> | area: <area> | intent: <what the fork's edit did>`)

## JUNCTION (what the tool and the Yardmaster do, so apply leaves it joinable)
- the Yardmaster joins the finished chunks onto `rr2/<line>/depot` in segment order (main first when it moved): a conflict → both records' `why:` and the notices, resolved so both intents hold
- the ledger: one line per notice in history order (step 7a form), written by the tool from the records: `commit:` = its intake commit, `upstream:` = its `upstream:` line, `notes:` = the records' notes and `open:` items joined, `relay:` from the record
- the checks of step 6 (`pnpm check --gate=ship`, `pnpm typecheck`, eslint) and the ownership check (step 7c) run on the joined line | CONDITIONS TO MOVE ON are checked there for every notice (the per-segment check of SKILL.md moves to the junction)
- a failure at a joint → the Yardmaster fixes it on the line | a failure inside one chunk's own work → the chunk goes back to a Ganger (`fix J<m>`), the chunks after it wait
- the Inspector checks the joined line at one commit (screens users see, read-only) | unsafe → the chunk holding the broken segment goes back
- depart (the human's word): main moves to the inspected junction commit and is pushed | the departure procedure runs the `db:` lines in notice order (`[user-run]` by the human) and the notices' manual_steps | FIXES / HOTFIX rules of SKILL.md about known-bug points: a departure point never sits between a fix's origin and its fix
