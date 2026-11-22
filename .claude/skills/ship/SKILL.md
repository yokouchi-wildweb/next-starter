---
name: ship
description: Ship this repo's changes (fix the range → checks → judge downstream impact → write a DOWNSTREAM NOTICE when needed → commit → push); the pair of the receiving side's /flux | When the user tells you to commit, push or ship, and on /inbox's completion
argument-hint: "[order:<指令 id>] [no-push] [notice:defer] [notices:<下書きのパス,…>] [hotfix] [--safe] [--quick] [補足メモ(任意)]"
---

role: **ship** (commit and push this repo's changes; when downstream forks need follow-up work, put a DOWNSTREAM NOTICE in the same commit) | the receiving side is downstream's `/flux`; write notices to match how it reads them | spec: `.notices/README.md`

## WHEN TO USE
- the user tells you to commit, push or ship (`コミットして`, `プッシュして`, `出荷して`) | no instruction → never use it (behavior.md: never commit without an instruction)
- from `/inbox` step 4 (`対応完了`) | the argument `order:<id>` comes with it
- from a tool or skill that ships for its caller (commit only with `--quick no-push`; a later plain ship of the commits already made: COMMITTED RANGE below)
- also in repos without downstream (leaf forks) | whether downstream exists = `tier` of `repo.json` (root / middle = yes, leaf = none; only reader: `src/lib/forkOwnership/forkIds.mjs`): `node --input-type=module -e "import { readForkIdentity } from './src/lib/forkOwnership/node.mjs'; const i = readForkIdentity('.'); console.log(i.downstream ?? i.downstreamError)"`
  - `none` → skip steps 3-5 (notice)
  - other than `yes` / `none` (declaration missing or wrong) → never guess from the text; STOP: have `tier` declared in `repo.json` (`pnpm workflow repo-json set tier <root|middle|leaf>`; `pnpm workflow ownership check` is unverified too)

args: $ARGUMENTS | `order:<id>` = shipping that came from an order | `no-push` = commit only, no push | `hotfix` = ship as an emergency fix (only when the human tells you; never add it on your own judgment, since it cuts into every fork's work) | the rest = extra notes
- `notice:defer` = someone writes the notice later (a caller that collects the material of several commits into one notice): steps 3-4 judge as usual, step 5 writes no notice, the report gives the material instead
- `notices:<path>,…` = notice drafts (one draft = one notice; a caller closing a segment it has drafted; the checkpoints are the draft's, never coarsened): step 5 writes one notice per draft from its `- ` items, `checkpoint:` = the draft's `segment:` header | with `no-push` | step 1 range empty → the commit holds the notices alone (step 2: `pnpm check notices` only)
- which kind (pick it yourself when the caller gave none):
  - more work follows in this session → `--quick`
  - the last ship of the session → plain (no flag; the human's words, else your own reading of whether work goes on) | its area checks also cover the quick ships not yet checked (step 2) | its report may propose a safe point (step 8)
- `--safe` = a safe ship: the full checks on the tip, and a safe point tag when they pass | forks stop /flux at a safe point before a production deploy; `--allow-unsafe=<reason>` for emergencies
- `--quick` = a quick ship: skips even the light checks, makes no safe point, marks the commit `Ship: quick` (QUICK SHIP, commit.md)

## ATTACHED FILES (must read when the condition hits; never go on without reading)
- **`commit.md`**: steps 0, 1, 3-6 and QUICK SHIP — every ship reads it (the STEPS below point to it)
- **`notice.md`**: NOTICE COMPOSITION — read when step 5 writes a notice

## STEPS (run in a row without confirmation; stop only on STOP CASES below)
0, 1. → commit.md (check the order's owner, fix the range)
2. **checks** (failed → fix and rerun; the fix is not obvious → STOP):
   - plain ship: `pnpm workflow notices safePoint quickFiles` first
     - line 1 `<N> quick commits unchecked`, then the files the run of `Ship: quick` commits behind HEAD changed (the walk stops at an unmarked commit or this repo's own safe tag; it walks on through a merge with neither `Ship:` nor `downstream-notice:`, e.g. a work merge a cargo kept, so the side it joined counts too)
     - add those files to the range the checks below look at (the commit range stays yours) | another session's quick change fails a check and the fix is not obvious → STOP | exit 2 → report `quick 分の検査: 未確認(<理由>)` and go on
   - always: `pnpm check --phase=ship` | failed → fix and rerun (generator drift → `pnpm generate <target>`)
     - it runs every check of the generators / checkers on phase ship, in order: role, domain, registry, routes, cron, cycles, config, eslint, and the watched rules (pnpm check rules when `CLAUDE.md` / `.claude/rules/` changed), notices (pnpm check notices when `.notices/` or the ship / flux skills changed)
     - targets the watch does not hit are skipped with one line; `--all` runs all | `scripts/runner/phases/README.md`
   - code changed (`.ts` / `.tsx` / `.js` / `.mjs`): `pnpm typecheck` and `pnpm exec eslint --no-warn-ignored <changed code files>` (an ignored file, e.g. a _template placeholder file, is skipped without a warning)
   - by where you changed (run every one that applies; checks on the phase = pnpm check registry, pnpm check routes, pnpm check cron, pnpm test scripts/structure/config/moduleLoad.test.mjs, pnpm check eslint, pnpm test scripts/structure/cycles/cycles.test.mjs, pnpm check rules, pnpm check notices are run by `pnpm check --phase=ship` above, never repeat them):
     - `pnpm test` skips the tests a phase runs unless named (D389)
     - adding / deleting under `src/lib/`, `src/lib/CATALOG.md` → `pnpm test src/lib/folderCatalog/catalog.test.mjs`
     - `domainEntry.ts`, `domain.json` → registry drift → `pnpm generate registry`
     - `entities/drizzle.ts`, `src/registry/schemaRegistry.ts` → `pnpm test scripts/structure/registry/` | an index changed → write the explanation of the diff `pnpm db:push:check` prints in the report (never run db:push itself)
     - `src/featureGate/rules/`, items of `src/proxies/*.ts`, cron `task.ts` → `pnpm check extensions` (drift → `pnpm generate extensions`) and `FEATURE_GATE_CHECK=all pnpm test src/featureGate scripts/structure/proxies`
     - adding / deleting / moving pages or routes, changing loaders or guard.ts → rebuild the map (`src/app/route-map.jsonl`) with `pnpm generate routes` and include it in the range, `pnpm test 'src/lib/screens/routeMap*.test.mjs'` (check --phase=ship also checks the map matches)
     - `domain.json`, role definitions (`*.role.json`), `*.profile.json` → `pnpm forge` (generation and post-checks in one go; include the generated files, the district map `src/registry/district-map.jsonl` and route-map changes in the range; write table-change guidance in the report)
     - `.claude/skills/` → the `*.test.mjs` beside the changed skill (`node --test <file>`) | a skill deleted or renamed → confirm with `git grep -n "/<旧名>"` that no reference remains (`.notices/` and `docs/journal/` are records, excluded)
     - scripts of `package.json` → run each added / changed script once and see it pass (one that needs a DB, external service or dev server → do not run it, report `未実行: 理由`)
     - none of the above: `pnpm test --changed` (tests reached by import from the range + tests in the same folder; a test printed as `依存を辿れなかった` was picked by the same-folder rule; DB tests are not run: changed `*.db.test.*` → `pnpm test --changed --db`; `scripts/runner/test/README.md`)
   - including a notice (after step 5) → `pnpm check notices` (called by name it runs without looking at the watch)
3-6. → commit.md (judge downstream impact, check whether it is a fix, write the notice (notice.md), commit)
7. **push** (not with `no-push`): first `pnpm workflow notices catchUp --onto=<push target>` every time (CATCH UP below: a tip that took the target into the line is rebuilt, else nothing) → `git push` | WORKTREE ROUTE below when it applies | failed → never paper over it, report the reason
   - rejected because the remote moved → `pnpm workflow notices catchUp --onto=<remote>/<branch>` (CATCH UP below), rerun `pnpm check notices` when it applies, push again (the full checks of `--safe` come after the push, so a moving remote never restarts them)
   - then, **with `--safe` only, run the full checks on the pushed HEAD** (a plain ship runs the area checks above instead and makes no tag; `.notices/README.md` section `区切り(checkpoint)と区間適用`, part `セーフポイント`): `pnpm workflow notices safePoint check`
     - upstream does not check intermediate checkpoints (each fork's /flux checks every segment on its side); only the pushed tip of a `--safe` ship gets the full checks
     - it needs a work tree equal to HEAD and runs on HEAD, in order: `pnpm test` (whole), `pnpm check`, `pnpm typecheck`, `pnpm lint`, the build (`next build` then `pnpm check --phase=build:post`: `pnpm build`'s own head gate is what `pnpm check` just ran); all pass → it records HEAD as checked (used by the tag below) | keep HEAD and the work tree as they are while it runs
     - exit 1 (a check failed): no tag | fix it in a new commit and ship that with `--safe` (the push stands) | the fix is not obvious → STOP
     - exit 2 (cannot run: uncommitted changes, a check changed tracked files, etc.): report `セーフポイントなし: <理由>` (no tag)
   - then **tag the safe point** (`--safe` only, when the check passed): `pnpm workflow notices safePoint tag`
     - it fetches `origin/<branch>` (WORKTREE ROUTE: `origin/main`, the tool's default), confirms the sha the check recorded is in it (equal or an ancestor: others may have pushed meanwhile), creates the annotated tag `safe/<own repo_id>/<YYYYMMDD>-<n>` (n = the next free number for that repo_id and day) on that sha and pushes it (`git push origin refs/tags/<tag>`)
     - exit 1 → no tag; write the reason in the report (the push stands; the next `--safe` ship tags its own tip)
     - a middle tier (`tier` middle) tags its own repo the same way (same /ship, same tool, its own repo_id in the tag name)
8. **report** (Japanese):
   - first line = downstream intake verdict (measured): `取り込み判定: 安全 | 要注意(理由)| 危険(理由)`
     - `危険` (danger) = a plain merge breaks the fork's build, boot or existing behavior / needs manual work on the fork side / behavior or permissions change silently | `要注意` (caution) = only as far as merge conflicts may happen | no downstream → omit
   - commit short sha, push target (or why not pushed), check results, the notice id and a summary of change (none written → `notice 不要: <理由>`; `notice:defer` → `notice: 後で書く(材料)` and the material lines), the reference of `fixes:` if added, the order id of `resolves:` if added
   - a `fixes:` notice shipped → give the `pick:` judgment (clean / `-` with the failed conditions / unverified)
   - `hotfix` → say it was shipped as an emergency fix, the result of the pick check, and that each fork needs `/flux` (forks do not notice until they run it)
   - the safe point: the tag name, or `セーフポイントなし: <理由>` (plain ship, `--quick`, `no-push`, a full check failed / could not run, the tag step failed)
   - plain ship (pushed): `pnpm workflow notices safePoint status` → write `セーフポイント: <line 1>` | line 2 `propose` → end the report with one line `セーフポイントを作りますか(/ship --safe、<line 1 の数>)` and wait for the human | exit 2 → `セーフポイント: 未確認(<理由>)` | not with `--quick` / `--safe`
     - score = commits since the last own safe tag ÷ 80 + days ÷ 3 (`--first-parent`); ≥ 1 → propose | no safe tag yet → propose
     - no human in this session (a team tool's executor that reports to its lead) → put that one proposal line in the result it hands back (RESOLUTION, status note, report) and end without waiting: the lead asks the human
   - came from `/inbox` → do not stop here, return to the rest of `/inbox` step 4 (RESOLUTION) | use the commit sha and push result there

## STOP CASES
- a file you cannot tell whether to put in the range (may be another session's change)
- a check failed and the fix is not obvious
- in the downstream impact judgment, the notice's required_actions cannot be written concretely enough for downstream Claude to run (the upstream change may be what should be fixed)
- `hotfix` depending on earlier unshipped / unreceived changes, or the pick check (`pnpm workflow notices pickCheck`) reported a conflict or a failed check (show the dependent changes, ask whether to drop hotfix for a normal shipment or remove the dependency)
- on stopping: show what you found and the options in plain text; STOP: wait

## WORKTREE ROUTE
- applies: in a linked worktree (`git rev-parse --git-dir` differs from `git rev-parse --git-common-dir`) whose branch has no upstream of its own (`git rev-parse --abbrev-ref @{u}` fails, or prints `origin/main`) | a branch tracking its own remote branch → a plain `git push` of that branch
- never touch the main checkout and never move its local `main` ref (no exception)
- `git fetch origin main` → `pnpm workflow notices catchUp` every time (CATCH UP below: lays the line again when origin/main is not an ancestor of HEAD — then rerun `pnpm check notices` when it applies —, rebuilds a tip that took origin/main into the line, else nothing; the full checks of `--safe` run after the push, step 7) → `git merge-base --is-ancestor origin/main HEAD` must succeed
- push with `git push origin HEAD:main` | the push target of this route = `origin/main` (COMMITTED RANGE, the safe point tag)
- any condition fails → STOP

## CATCH UP (laying your branch again on a moved push target — D395 (2))
- `pnpm workflow notices catchUp [--onto=<ref>]` (default origin/main): the same commits in the same order on the target; a work merge (a guild ticket's merge a cargo kept) stays a merge, a merge that took main into the line is dropped (main's first-parent is one line), the line's root moves onto the target | never a plain `git rebase` (it flattens the work merges)
- only for a line with one owner (the branch you /ship); a line several build on (a guild's junction) catches up by the tool's merge, never this | it never reorders (not a reorder of a run with merges, D383)
- tip rebuild (D402): origin/main is an ancestor of HEAD but the tip is a merge that took the target itself into the line (first parent = the line, second = the target)
  - → the same tree as a merge whose first parent is the target and second the line, the same author, subject `merge: <branch> を main へ`; one line `catchUp: 組み直した …`, never a stop
  - why: pushed as is, the previous main would leave main's first-parent line | such a merge further down the line is not rebuilt
- exit 1 = stopped on a conflict inside the rebase (git rerere replays what was solved before): solve, `git add`, `git rebase --continue` | exit 2 = cannot run (reason printed) → STOP

## SHIPPED TIP (plain or `--safe`, step 1's range is empty, HEAD = the push target)
- closes a tip already pushed (e.g. by `--quick` ships) without a new commit | no commit, no notice, no push of commits
- `git fetch origin <branch>` → HEAD must equal the push target (`origin/<branch>`; WORKTREE ROUTE: `origin/main`) | HEAD behind or ahead → not this route (ahead = COMMITTED RANGE; behind → STOP: say so)
- plain:
  - `pnpm workflow notices safePoint quickFiles` | `0 quick commits unchecked` → report `出荷するものなし(検査していない quick の分もなし)` and end
  - else step 2's checks on those files (`pnpm check --phase=ship`, the code checks and the area checks they hit) | failed → fix in a new commit and ship it as a plain ship (step 1 onward) | the fix is not obvious → STOP
  - all pass → `pnpm workflow notices safePoint quickChecked` (records HEAD; the next `quickFiles` stops there) → step 8's report with `safePoint status` (may propose a safe point)
- `--safe`:
  - HEAD already carries an own safe tag (`pnpm workflow notices safePoint status` prints `at <tag>`) → report `セーフポイント: 既にある <tag>` and end
  - step 7's full checks (`pnpm workflow notices safePoint check`) → step 7's tag (`pnpm workflow notices safePoint tag`) | exit codes as there
- report: the checks' result, the quick commits covered, the tag name (or `セーフポイントなし: <理由>`) | an older commit than the tip → not covered here (needs a separate procedure)

## COMMITTED RANGE (step 1's range is empty, HEAD ahead of the push target)
- the commits on HEAD the push target lacks (`git log --format='%h %s' <target>..HEAD`; target = `origin/main` on the WORKTREE ROUTE, else `origin/<branch>`) = commits made earlier by /ship (e.g. `--quick no-push` ships, collected onto this branch): their notices are in them
- skip: step 0 (the caller answers the orders), steps 2-5, step 6's commit | never with `hotfix`
- keep:
  - step 6's `pnpm workflow notices reorder` first (the range is unpushed; with `no-push` it waits for the push)
  - each commit in the range that adds a `fixes:` notice → step 6's pickCheck on it (`pnpm workflow notices pickCheck <that commit>`; it writes `pick:` in the notice's body) → commit the bodies alone: `git commit -m "notices: pick marks" -- .notices/<id>.md`
  - a notice in the range → `pnpm check notices`
  - `--safe` → step 7's full checks on the pushed tip | plain → step 2's area checks on the range's files (`git diff --name-only <target>..HEAD`) plus `safePoint quickFiles --through=<target>` (it walks through the range whatever its marks and counts the quick commits pushed below it — from HEAD it would stop at the range's first unmarked commit)
  - steps 7 and 8 (the report lists the commits shipped)

## CLEANING UP BODIES
- bodies of notices whose segment closed may be deleted on the upstream side (no deadline; never moved to `done/`; the history keeps the last version)
- notices using migrations / codemods: ship → run on your own DB → delete the attachments and body in the next commit
- a deletion that only cleans up needs no notice (`.notices/README.md` section `本文と添付物の片付け`)
- ledgers do not flow upstream, so upstream does not track application status

language: reply Japanese | notice contents English
