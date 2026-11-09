# railroad (attached to /flux: the modes `intake` and `apply`)
role: inside the railroad team tool, split the segment cycle into two jobs run at the same time: the Tracklayer merges segments ahead (`intake`), Gangers apply the follow-up behind (`apply`) | integration, checks, ledger and push happen at a station, a railroad command (STATION below), never in these modes
read: before running `/flux intake …` or `/flux apply …` | every rule of SKILL.md holds unless this file says otherwise

## WHEN
- only inside railroad: the runtime header names `railroad:` and your record paths | run alone (no header) → say these modes need the railroad tool; STOP
- FOLLOW UPSTREAM'S LATEST STEPS applies: read this file as upstream's version too (`git show <upstream>/<branch>:.claude/skills/flux/railroad.md`)

## BRANCHES AND WORKTREES (local only)
- `rr/<line>/track` = the Tracklayer's branch: intake commits only | `rr/<line>/ganger<n>` = one per Ganger | `rr/<line>/station` = built by the station command
- each tab works in its own worktree (the header's `worktree:`) | never push any `rr/` branch (preview deploys, CI) | never commit to main
- main moves only when the human opens a station (the railroad command); the fork's other work may land on main meanwhile: Gangers and the station merge main in

## INTAKE (`/flux intake [<n> | all] [to <position>]`, the Tracklayer)
what changes from FULL FLOW:
1. recon (step 1) and the overview (step 2) as usual | the next plan = merge only: per segment the conflict forecast (CONFLICT FORECAST) and the areas its upstream diff touches (top folders / domains: the Director splits the Gangers' work by them) | no application plan, no 6 points, no approval wording of SKILL.md (the Director relays `go`)
2. width = the speed the Director sends (`各停` 1 / `快速` 5 / `特急` 10 / `直通` all) | HEAVY SEGMENTS and LIGHT SEGMENTS do not apply (the weight is the Gangers')
3. merge (step 5): a (lineage-touch, side-commit check), b, d (out-of-segment check) and e unchanged | c (conflicts): resolve the obvious ones yourself (upstream intent + the fork's edit)
   - a conflict needing judgment → never pick a side silently | propose the way you think best, with the other options, and stop (state question)
   - one option you may propose = provisional (`仮線`): take one side now, save the other side's hunks as a patch, the Ganger of that area ports it
   - the patch: `<provisional_dir>/<checkpoint>.<n>.diff` + a 1-line intent in `<checkpoint>.<n>.md` (file, what the fork's edit meant)
   - `moved:` porting (moved.md) = application work: save the diff as moved.md step 2 says into `<provisional_dir>/`, do not port
4. segment 0 (in-tree unapplied notices, nothing to merge) → `git commit --allow-empty`, so every notice has its intake commit
5. never merge main into the track: it carries the upstream's segments only (the Gangers and the station merge main in)
6. skip steps 6-7 (no application, no checks beyond the merge's own, no ledger, no ownership check, no push)
7. intake commit message: `railroad intake: <checkpoint label>` + blank line + `downstream-notice: <id>` per notice of the segment (history order) + `upstream: <merge target full sha>` | the station reads these lines: never reword them
8. stop only at: a side-commit / lineage-touch / out-of-segment stop, a conflict needing judgment, the end point, the upstream tip | report what was laid (checkpoint labels), provisional patches (count, area), the areas touched — in the status / plan files the header names; chat = 1-3 lines
- state is derived from history (intake commits on the track) | rerunning continues after the last intake commit

## APPLY (`/flux apply <area> to <station>`, a Ganger)
1. sync: merge `rr/<line>/track` at the station's intake commit (never past it) and main into your branch | `pnpm install` when the lockfile changed | conflicts with your own earlier work: yours to resolve
2. scope = the notices from main's last applied one up to the station × your area (the folders / domains the Director's assign names) + the provisional patches of that area
3. do step 6 (execute: sweep and follow-up) for that scope once, against the station's state: intermediate states are skipped, a later notice up to the station that rewrites the same spot wins | REVIEW OF FORK EDITS IN UPSTREAM-OWNED PATHS applies | provisional patches → port them, delete the patch file when ported
4. checks scoped to your area: `pnpm typecheck`, `pnpm exec eslint <changed files>`, the notices' `verify:` that only touch your area | the full checks run at the station | a failure outside your area → a note to the Director (never edit another area)
5. data: none here | the dev DB was brought to the station's schema at assign; a backfill / migration a notice asks for → list it in the record (`db:`), the station's opening procedure runs it
6. keep only the 3 allowed kinds (`order:` / `human:` / `migration:`), same as "segment done" | a judgment you cannot make → state question with options and your recommendation; the Director asks the human
7. write the record (RECORDS) and commit to your branch | relay judgment (a fork with `downstream: yes`, relay.md RELAY JUDGMENT): only the Ganger the assign names `relay:` writes it, for every notice of the station

## RECORDS (fixed forms; the station command reads them, so never reshape them)
- Ganger record `<your_record>` (one per station): first line `# GANGER RECORD ganger:<tab> station:<checkpoint label> track:<intake commit sha> commit:<your branch head> submitted:<ISO8601>`
  - then `area: <as assigned>` and one line per notice of the station that your area touched: `- notice:<id> | aligned:<what moved> | kept_old:<… | order:<id> | -> | notes:<deviations | ->`
  - then `open: <item> | order:<id>` / `| human:<reason>` / `| migration:<id>` lines (0 or more), `db: <notice id>: <step>` lines (0 or more), `relay: <notice id>: <none | relay notice id>` lines (only the relay Ganger)
- provisional patch: `<provisional_dir>/<checkpoint>.<n>.diff` + `.md` (one line: `file: <path> | area: <area> | intent: <what the fork's edit did>`)

## STATION (`railroad station <line> <checkpoint>`; what it does, so apply leaves it passable)
- merges the track at the station's intake commit + every Ganger branch + main into `rr/<line>/station`
- runs the segment checks of step 6 (`pnpm check --gate=ship`, `pnpm typecheck`, eslint on the changed files) and each notice's `verify:`
- writes one ledger line per notice in history order (step 7a form): `commit:` = its intake commit, `upstream:` = its `upstream:` line, `notes:` = the Gangers' notes and `open:` items joined, `relay:` from the relay Ganger
- runs the ownership check (step 7c) | CONDITIONS TO MOVE ON are checked here for every notice of the station (the per-segment check of SKILL.md moves to the station)
- a failure → names the owning Ganger (by area) and stops; the fix is that Ganger's, then the station is built again
- opening (the human's word): main fast-forwards / merges to the station commit and is pushed; the opening procedure runs the `db:` lines in notice order (`[user-run]` by the human), then FIXES / HOTFIX rules of SKILL.md about known-bug points: a station is never placed between a fix's origin and its fix
