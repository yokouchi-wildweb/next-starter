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
- also in repos without downstream (leaf forks) | whether downstream exists = `tier` of `repo.json` (root / middle = yes, leaf = none; only reader: `src/lib/forkOwnership/forkIds.mjs`): `node --input-type=module -e "import { readForkIdentity } from './src/lib/forkOwnership/forkIds.mjs'; const i = readForkIdentity('.'); console.log(i.downstream ?? i.downstreamError)"`
  - `none` → skip steps 3-5 (notice)
  - other than `yes` / `none` (declaration missing or wrong) → never guess from the text; STOP: have `tier` declared in `repo.json` (`pnpm workflow repo-json set tier <root|middle|leaf>`; `pnpm workflow ownership check` is unverified too)

args: $ARGUMENTS | `order:<id>` = shipping that came from an order | `no-push` = commit only, no push | `hotfix` = ship as an emergency fix (only when the human tells you; never add it on your own judgment, since it cuts into every fork's work) | the rest = extra notes
- `notice:defer` = someone writes the notice later (a caller that collects the material of several commits into one notice): steps 3-4 judge as usual, step 5 writes no notice, the report gives the material instead
- `notices:<path>,…` = notice drafts (one draft = one notice; a caller closing a segment it has drafted; the checkpoints are the draft's, never coarsened): step 5 writes one notice per draft from its `- ` items, `checkpoint:` = the draft's `segment:` header | with `no-push` | step 1 range empty → the commit holds the notices alone (step 2: `pnpm check notices` only)
- which kind (pick it yourself when the caller gave none):
  - more work follows in this session → `--quick`
  - the last ship of the session → plain (no flag; the human's words, else your own reading of whether work goes on) | its area checks also cover the quick ships not yet checked (step 2) | its report may propose a safe point (step 8)
- `--safe` = a safe ship: the full checks on the tip, and a safe point tag when they pass | forks stop /flux at a safe point before a production deploy; `--allow-unsafe=<reason>` for emergencies
- `--quick` = a quick ship: skips even the light checks, makes no safe point, marks the commit `Ship: quick` (QUICK SHIP below)

## STEPS (run in a row without confirmation; stop only on STOP CASES below)
0. **check the order's owner** (only with the argument `order:<id>`): find that id in the output of `node .claude/skills/order/mailbox.mjs inbox`
   - first word `taken` with no `(you)` in `taken_by:`, or `routed` with no `(you)` in `routed_to:` → **an order someone else owns**: warn `<id> は <担当> が持っています`; STOP (avoids shipping twice with another session; the human decides whether to continue; if the human continues, /inbox's resolve needs `--force=<理由>`)
   - not in the list (already done/) → STOP: say so
   - open, or your own → go on
1. **fix the range**:
   - `git status --short` and `git diff --cached --name-only` | other sessions may have staged in the same work tree | ship only the files you changed in this conversation (match them against the files touched in the conversation) | any file you cannot tell → STOP
   - range empty → HEAD has commits the push target lacks (COMMITTED RANGE below) → ship those | none → plain or `--safe`: SHIPPED TIP below | `--quick`: report only `出荷するものなし` (nothing to ship) and end (no commit, no push)
   - **never put migrations kept out of git `src/features/**/scripts/migrations/*.local.ts` in the range** (emergency data fixes not sent downstream; one `.gitignore` line) | staged or tracked → STOP (gate ship's `pnpm check local-migrations` fails too; remove with `git rm --cached <path>`; needed downstream too → drop `.local` and make it a normal migration with `notice:`)
   - list deletions and renames: the `D` / `R` lines of `git status --short` and files deleted in the work tree | used by the judgment of step 3 and by `moved:`
   - **check for overlap with other sessions' commits**:
     - base = the HEAD at the start of the conversation (latest commit of the environment's gitStatus; none → the HEAD you saw when starting the work)
     - from `git log --format='%h %(trailers:key=Claude-Session,valueonly,separator=) %s' <base>..HEAD -- <range files (deleted ones included)>`, drop this conversation's commits (`Claude-Session:` = this conversation's session URL) | empty → next
     - for each remaining commit read `git show <sha> -- <file>`:
       - a file you deleted or moved, or rewrote whole → carry that change over to the destination (cannot → STOP)
       - a file you only edited in part → confirm with `git diff HEAD -- <file>` that you did not revert that change
     - write what you carried over in the report and the commit body | partial edits keep others' changes naturally since the work tree sits on HEAD; changes get lost only on delete, move or whole rewrite
2. **checks** (failed → fix and rerun; the fix is not obvious → STOP):
   - plain ship: `pnpm workflow notices safePoint quickFiles` first
     - line 1 `<N> quick commits unchecked`, then the files the run of `Ship: quick` commits behind HEAD changed (the walk stops at an unmarked commit or this repo's own safe tag)
     - add those files to the range the checks below look at (the commit range stays yours) | another session's quick change fails a check and the fix is not obvious → STOP | exit 2 → report `quick 分の検査: 未確認(<理由>)` and go on
   - always: `pnpm check --gate=ship` | failed → fix and rerun (generator drift → `pnpm generate <target>`)
     - it runs every check of the generators / checkers on gate ship, in order: role, domain, registry, routes, cron, cycles, config, eslint, and the watched rules (pnpm check rules when `CLAUDE.md` / `.claude/rules/` changed), notices (pnpm check notices when `.notices/` or the ship / flux skills changed)
     - targets the watch does not hit are skipped with one line; `--all` runs all | `scripts/runner/gates/README.md`
   - code changed (`.ts` / `.tsx` / `.js` / `.mjs`): `pnpm typecheck` and `pnpm exec eslint --no-warn-ignored <changed code files>` (an ignored file, e.g. a _template placeholder file, is skipped without a warning)
   - by where you changed (run every one that applies; checks on the gate = pnpm check registry, pnpm check routes, pnpm check cron, pnpm test scripts/structure/config/moduleLoad.test.mjs, pnpm check eslint, pnpm test scripts/structure/cycles/cycles.test.mjs, pnpm check rules, pnpm check notices are run by `pnpm check --gate=ship` above, never repeat them):
     - adding / deleting under `src/lib/`, `src/lib/CATALOG.md` → `pnpm test src/lib/folderCatalog/catalog.test.mjs`
     - `domainEntry.ts`, `domain.json` → registry drift → `pnpm generate registry`
     - `entities/drizzle.ts`, `src/registry/schemaRegistry.ts` → `pnpm test scripts/structure/registry/` | an index changed → write the explanation of the diff `pnpm db:push:check` prints in the report (never run db:push itself)
     - `src/featureGate/rules/`, items of `src/proxies/*.ts`, cron `task.ts` → `pnpm check extensions` (drift → `pnpm generate extensions`) and `FEATURE_GATE_CHECK=all pnpm test src/featureGate scripts/structure/proxies`
     - adding / deleting / moving pages or routes, changing loaders or guard.ts → rebuild the map (`src/app/route-map.jsonl`) with `pnpm generate routes` and include it in the range, `pnpm test 'src/lib/screens/routeMap*.test.mjs'` (check --gate=ship also checks the map matches)
     - `domain.json`, role definitions (`*.role.json`), `*.profile.json` → `pnpm forge` (generation and post-checks in one go; include the generated files, the district map `src/registry/district-map.jsonl` and route-map changes in the range; write table-change guidance in the report)
     - `.claude/skills/` → the `*.test.mjs` beside the changed skill (`node --test <file>`) | a skill deleted or renamed → confirm with `git grep -n "/<旧名>"` that no reference remains (`.notices/` and `docs/journal/` are records, excluded)
     - scripts of `package.json` → run each added / changed script once and see it pass (one that needs a DB, external service or dev server → do not run it, report `未実行: 理由`)
     - none of the above: `pnpm test --changed` (tests reached by import from the range + tests in the same folder; a test printed as `依存を辿れなかった` was picked by the same-folder rule; DB tests are not run: changed `*.db.test.*` → `pnpm test --changed --db`; `scripts/runner/test/README.md`)
   - including a notice (after step 5) → `pnpm check notices` (called by name it runs without looking at the watch)
3. **judge downstream impact** (repos with downstream only): any of the following → a notice is needed | none → write one line `notice 不要: <理由>` in the report and go to step 6
   - deleting / moving files forks may touch (docs, READMEs, registry, config, core parts …) (`.notices/README.md` section `削除・移動は notice と同じ commit で出す`)
   - forks' existing code drifts from the new spec: deleting / renaming exports, changing argument / props / return types, adding or removing config keys, changing generator output, naming or placement conventions
   - manual work on the fork side: `db:push` (tables, columns, indexes), regeneration, env, external preparation, adding / removing / retiming cron (`pnpm generate cron`)
   - behavior or permissions change silently
   - the rules / README of the changed area ask for a notice (conditions in CLAUDE.md, `.claude/rules/core/` or a colocated README saying `→ notice` / `ship .notices`; read those of the changed area to confirm)
   - a fix to something shipped earlier (step 4)
   - renaming / moving / removing a rule key (a `key:` at the head of a line of CLAUDE.md, a core file `.claude/rules/core/*.md`, an item card `.claude/rules/items/**` or `.claude/rules/lineage.md`): forks name upstream rules by key (provisional rules, overrides, their own rule files) → always a notice with the key table (NOTICE COMPOSITION)
   - you changed your own section of `.claude/rules/lineage.md` (`## <own repo_id>`): a change of rules that act downstream → always a notice
     - wording-only change = `severity: info` + `required_actions: none`
     - deleting / renaming a `(default)` key, dropping `(default)`, or a contract change that needs downstream work → in `required_actions`, write how downstream repos that wrote an override (`overrides: <own repo_id>.<key> = …`) fix it (rewrite to the key's new name, delete the override, etc.; downstream `/flux` stops at a segment that touches an overridden key)
   - resolving an order from a downstream fork: the argument `order:<id>` is given and the order's sender is a repo other than this one (judged by `requester` of `node .claude/skills/order/mailbox.mjs`; the head of the order's `from:` is a repo origin URL different from this repo)
     - write `resolves: <id>` in the notice | even when no other notice is needed, ship a notice with `severity: info` + `required_actions: none` + `checkpoint:` (used to expire downstream temporary permits; `.notices/README.md` section `解決(resolves)`) | also for orders closed by rejecting or withdrawing
     - never tell forks to keep a temporary permit that cites the resolved id (it expires as expired-resolved when the fork takes the notice)
     - fork-side work remains (e.g. moving its own data) → required_actions: re-cite that permit's `upreq:` with an order id the fork files to itself (before taking it or in the same segment) | verify: `pnpm workflow ownership check` shows the row valid | such a notice is not `required_actions: none` (`.notices/README.md` section `解決(resolves)`)
4. **check whether it is a fix**: first judge by the conversation's context (a bug report, the order's need, `直して`)
   - the context says it is a fix, or you changed / deleted existing lines of code → identify the origin by the blame below
   - only additions to docs, skills or config, and no bug in the context → skip the check, write `修正ではない` (not a fix) in the report
   - add `fixes:` only when a fork stopped at the origin's checkpoint is harmed in its build, boot, behavior or data (checks fail, it fixes it on its own, it re-orders the same bug)
     - /flux stops every fork before that checkpoint and asks, so harmless ones (improvements to upstream-side tools, skills, doc wording) are not treated as fixes (whether a notice is needed is judged by the other items of step 3)
   - identifying the origin: trace the changed lines
     - run `git blame -L <range> HEAD -- <file>` on the lines before the change (or `git log -L`), see whether the commits found fall in a recent notice's segment (before / after each notice's adding commit of `git log --diff-filter=A --format=%H -- .notices/`)
     - together with the context (bug report, the order's need), a fix of a bug of an earlier shipment → a `fixes:` candidate | the origin has a notice → its id; none → `commit:<短 sha>`
     - even when this fix needs no fork follow-up, ship a notice to carry `fixes:` (`severity: info`, `required_actions: none`)
5. **write the notice** (only when needed; write it out without asking first; NOTICE COMPOSITION below)
   - `notice:defer` → write nothing here: list the material for the report instead (one line per item: what changed for forks, required_actions / `[user-run]` steps, `moved:` / deleted paths, `fixes:` origin, `resolves: <id>` when step 3 found an order to resolve — never dropped; `none` when step 3 found no need) and go to step 6
   - `notices:` → one notice per draft: every `- ` item goes in (into change / required_actions / manual_steps / moved: as it reads; `resolves: <id>` items → `resolves:`, `fixes: <id>` items → `fixes:`), plus what steps 3-4 found in this ship's own range; `checkpoint:` = the draft's segment | an item left out → say it in the report (the caller records it)
   - no index: the list of shipped notices is the history of `.notices/` (D350) | line 2 `from:` = this repo's origin URL (the owner forks read) | then pass step 2's `pnpm check notices`
6. **commit**:
   - put in only your own files (never sweep in other sessions' staging) | the notice goes in the same commit as the change itself:
     - pass to `git add` only paths that exist in the work tree (passing deleted / move-source paths stops with a pathspec error; stage deletions with `git rm` or include them in the commit pathspec next)
     - include deleted paths and directories in `git commit -- <paths>` (the commit pathspec picks up deletions)
     - before committing, confirm with `git diff --cached --name-only` that only the range's files are in
   - message in the behavior.md form (subject `<area>: <summary>`, blank line, body = decision record) | with `order:<id>`, a line `order: <id>` after the body | the trailer the environment specifies at the end | `--quick` → a trailer line `Ship: quick` in that same last paragraph (read by `safePoint quickFiles`)
   - branch follows behavior.md and the repo's policy (already on a feature branch → stay)
   - the change itself was committed already and only the notice was written later → make it the commit right after the change (no other notice commit in between) | not allowed with `hotfix` (change and notice always in the same commit; separate → undo and recombine)
   - not with `no-push` (the push that follows runs it): after the commit, before the pick check, **move each notice's add to its last edit** (D353): `pnpm workflow notices reorder`
     - rewrites only the unpushed range (`<push target>..HEAD`, the same target as step 7 / WORKTREE ROUTE): a notice added and then edited by a later commit of the range is added at that last commit instead (its checkpoint point = the add); commit count, the tip's tree, authors and messages stay
     - never moves a `hotfix:` notice, a body the range deletes or renames, an edit past the next notice's add (the line `<id> は次の区切りの後で直されています` → a correction that needs fork work goes into a new notice with `fixes:`, D351), nor anything when the range has a merge | none of these stops the ship
     - exit 2 → report `並べ替え: 未確認(<理由>)` and go on | the pick check, the hotfix check and the report use the shas after it | its lines (moved ids, not moved) go in the report
   - a `fixes:` notice included → after the commit, before push, **judge whether it can be picked ahead** (`.notices/README.md` section `修正(fixes)`, part `先に取れる印(pick)`): `pnpm workflow notices pickCheck <this commit>`
     - on a temporary tree that puts only this commit on the broken point (the commit of the origin's checkpoint; other `pick: clean` fixes the fork has picked ahead up to that point go on first), it checks:
       - one commit, no lock / route-map, steps naming no later notice, no cherry-pick conflict, `pnpm typecheck`, `pnpm test scripts/structure/config/moduleLoad.test.mjs`, `pnpm check registry`, the prerequisite check
       - changes to `.notices/shipped/` (older commits that still carry the removed index) are dropped when putting them on
         - sunset: 20261120-122554-notice-history (remove once every fork has taken that notice)
     - it writes `pick: clean` or `pick: -` in **that notice's body** (the line right after `fixes:`; humans never write or rewrite it; the body missing from the work tree → it writes nothing and exits 2)
     - exit 0 / 1 (clean / -): put the written body in the same commit: `git commit --amend --no-edit -- .notices/<id>.md` (only your own commit before push; `pick:` does not affect the judgment) → `pnpm check notices` | with `-` too, ship without stopping (the fork receives it by the current fixes behavior) | write the failed conditions in the report
     - exit 2 (cannot judge: origin not in history, dependencies cannot be installed): ship without the field (no field = same as `-`), report `pick 未確認: <理由>`
     - `未実行: <検査>` (the base tree has no script for it) → write in the report
   - with `hotfix`, before the commit, **keep it to one purpose** (`.notices/README.md` section `緊急修正(hotfix)`): one fix, never mixed with moving / renaming / relocating files (forks apply it file by file; a moved file is only found in a lagging fork by its old place)
     - a fix of only the tools /flux reads from the upstream tip (`.claude/skills/flux/`) is never a hotfix (forks already read the tip's version) → ship it plainly
   - with `hotfix`, after the commit, before push, **check that it can be picked** (`.notices/README.md` section `緊急修正(hotfix)`): pass `pnpm check notices` again
     - with `fixes:`, the `pnpm workflow notices pickCheck` above doubles as this check: the reason for `-` is a conflict, a failed check or a dependency on a later notice → no push; STOP (STOP CASES)
     - no `fixes:` → skip it (which version to apply to cannot be decided; report `未確認: 修正元なし`)
7. **push** (not with `no-push`): `git push` | WORKTREE ROUTE below when it applies | failed → never paper over it, report the reason | rejected because the remote moved → rebase onto it, rerun `pnpm check notices` when it applies, push again (the full checks of `--safe` come after the push, so a moving remote never restarts them)
   - then, **with `--safe` only, run the full checks on the pushed HEAD** (a plain ship runs the area checks above instead and makes no tag; `.notices/README.md` section `区切り(checkpoint)と区間適用`, part `セーフポイント`): `pnpm workflow notices safePoint check`
     - upstream does not check intermediate checkpoints (each fork's /flux checks every segment on its side); only the pushed tip of a `--safe` ship gets the full checks
     - it needs a work tree equal to HEAD and runs on HEAD, in order: `pnpm test` (whole), `pnpm check`, `pnpm typecheck`, `pnpm lint`, the build (`next build` then `pnpm check --gate=build:post`: `pnpm build`'s own head gate is what `pnpm check` just ran); all pass → it records HEAD as checked (used by the tag below) | keep HEAD and the work tree as they are while it runs
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

## QUICK SHIP (`--quick`)
- for every ship but the last of a session | makes no safe point | a run of quick ships is closed by a plain ship (its area checks take in the unchecked quick files, step 2) or a `--safe` ship (full checks on the tip)
- runs no check except `pnpm check notices` (only when a notice is added or changed): skips step 2 entirely otherwise (`pnpm check --gate=ship` included), step 6's pickCheck, step 7's full checks and tag
- keeps: steps 0, 1, 3-5 (notice judgment and writing), commit (with the `Ship: quick` trailer), push
- ship route: anywhere | in a linked worktree → WORKTREE ROUTE below when it applies | the main checkout → a plain `git push`

## WORKTREE ROUTE
- applies: in a linked worktree (`git rev-parse --git-dir` differs from `git rev-parse --git-common-dir`) whose branch has no upstream of its own (`git rev-parse --abbrev-ref @{u}` fails, or prints `origin/main`) | a branch tracking its own remote branch → a plain `git push` of that branch
- never touch the main checkout and never move its local `main` ref (no exception)
- `git fetch origin main` → `git merge-base --is-ancestor origin/main HEAD` must succeed (not → rebase onto origin/main, rerun `pnpm check notices` when it applies; the full checks of `--safe` run after the push, step 7)
- push with `git push origin HEAD:main` | the push target of this route = `origin/main` (COMMITTED RANGE, the safe point tag)
- any condition fails → STOP

## SHIPPED TIP (plain or `--safe`, step 1's range is empty, HEAD = the push target)
- closes a tip already pushed (e.g. by `--quick` ships) without a new commit | no commit, no notice, no push of commits
- `git fetch origin <branch>` → HEAD must equal the push target (`origin/<branch>`; WORKTREE ROUTE: `origin/main`) | HEAD behind or ahead → not this route (ahead = COMMITTED RANGE; behind → STOP: say so)
- plain:
  - `pnpm workflow notices safePoint quickFiles` | `0 quick commits unchecked` → report `出荷するものなし(検査していない quick の分もなし)` and end
  - else step 2's checks on those files (`pnpm check --gate=ship`, the code checks and the area checks they hit) | failed → fix in a new commit and ship it as a plain ship (step 1 onward) | the fix is not obvious → STOP
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
  - `--safe` → step 7's full checks on the pushed tip | plain → step 2's area checks on the range's files (`git diff --name-only <target>..HEAD`) plus `safePoint quickFiles`
  - steps 7 and 8 (the report lists the commits shipped)

## NOTICE COMPOSITION
1. **get provenance with Bash** (never guess): repo `git remote get-url origin` (none → `(no remote)`) / branch `git rev-parse --abbrev-ref HEAD` / commit `git rev-parse --short HEAD` (goes into the commit about to be made → `- (this commit)`) / id timestamp `date +%Y%m%d-%H%M%S`
2. compose into **exactly this schema** (a machine-to-machine file: English, terse, no prose or tables):
   ```
   # DOWNSTREAM NOTICE id:<ts>-<slug>
   from: <upstream repo> | branch:<branch> | commit:<short sha>
   date: <ISO8601>
   severity: breaking | action-required | info
   checkpoint: <label | ->
   moved: <old path> -> <new path>; ...   (only when the change moves/renames files or dirs; omit the line otherwise)
   fixes: <notice id | commit:<sha>>, ...   (only when this change fixes something shipped earlier; omit the line otherwise)
   skip_checkpoint: <notice id>, ...   (only on a fix that cannot be picked ahead, see below; omit the line otherwise)
   uses: <path>, ...   (only when required_actions run a migration / codemod shipped in this commit; omit the line otherwise)
   resolves: <order id>, ...   (only when this change resolves orders a downstream repo filed in this repo's inbox; omit the line otherwise)
   hotfix: <why forks must take this ahead of other changes, one line>   (only with the `hotfix` argument; omit the line otherwise)
   change: <what changed upstream, one line>
   why: <why downstream must follow up>
   required_actions:
   1. <step executable by downstream Claude as-is: target files, commands, order>
   2. [user-run] <a step the fork's policy may keep for the human (e.g. pnpm db:push) — /flux follows repo.json: off → the user runs it in-session via `!`, manual → /allow, then continues>
   verify: <how downstream Claude verifies the result itself: query / curl / test command>
   manual_steps: <steps outside Claude's reach (Vercel env vars, external dashboards) | - if none>
   refs: <upstream files / commits / docs / related order id>
   notes: <anything else downstream should know>
   ```
   - `<slug>` = a short English kebab from change | saved at `.notices/<ts>-<slug>.md`
   - never write `pick:` yourself (step 6's pick-check writes it in the body)
   - **`uses:`**: list the migrations (`src/features/<domain>/scripts/migrations/`) and codemods (`.notices/<id>.<名前>.mjs`) required_actions run, and put them in the same commit | a notice with `uses:` makes `checkpoint:` a label (`-` not allowed) | `pnpm check notices` checks they exist and the checkpoint (`.notices/README.md` section `使う移行・codemod の欄`)
   - **`skip_checkpoint:`**: only when the `fixes:` origin's checkpoint does not work (the fork's checks fail there) and step 6's pick-check gives `-` → write the origin's id (each id must be in `fixes:`; the fix notice itself is a labeled checkpoint) | the origin has `uses:` → cannot be skipped
     - added to the body after the pick-check → `git commit --amend --no-edit -- .notices/<id>.md` → `pnpm check notices` (`.notices/README.md` section `区切りを外す欄`)
   - required_actions, verify and refs of a `fixes:` notice never name paths / scripts missing from the broken point's tree (tools added later etc.) (the fork takes it right after the broken point, so the pick-check's prerequisite check makes it `-`) | to mention later tools, write them in notes (the prerequisite check does not read notes)
   - required_actions of a `hotfix:` notice are written without assuming the changes in between or later notices (the fork applies it skipping them; what its tree lacks the fork's hotfixApply skips and reports as `left-out` / `gap`, never a stop) | never include `pnpm-lock.yaml` or `src/app/route-map.jsonl` in the commit (contents differ per fork; `pnpm check notices` checks)
   - **required_actions = "concrete enough for downstream Claude to run without stopping after one approval"**
     - DB migrations, backfills, regeneration and data migrations all go here | only steps the fork's policy may keep for the human (db push, interactive prompts) get `[user-run]`
     - regenerate a domain with `pnpm generate domain -- <Domain>` (no prompts by default; no `[user-run]`), naming only the needed categories with `--only` | the fork-side bulk rebuild after adding settings = `pnpm forge`
   - a change that makes forks' existing code drift from the new spec → write markers to find the fork's target code (grep patterns etc.) and the steps to align it to the new spec | never leave compat for forks to sit on
   - split only what cannot be automated into `manual_steps` (fail-auto)
   - **a change that acts on the whole admin** (changing admin shared parts, the admin layout / guard / loader set, the Screen-building API, etc.): never end its notice with regenerating the generated admin (`pnpm generate domain`)
     - forks have hand-written admin pages of domains with `"adminRoutes": false` and `_components/` copied from the generated ones | write the following into required_actions as is:
     - (a) list domains with hand-written admin pages: `git grep -l '"adminRoutes": *false' -- 'src/features/**/domain.json'`
     - (b) list admin files using the changed API: `git grep -l -E '<変えた API の名前>' -- 'src/app/admin/**'` | drop those whose head says `このファイルは pnpm generate domain が生成する` (regeneration fixes them) and those equal to upstream (`git diff --quiet <upstream>/<branch> -- <file>` shows no diff = merge fixes them); the rest = the fork's hand-written ones
     - (c) the steps to align each remaining file to the new form | verify holds `pnpm typecheck` and "the rest of (b) is 0 files, or all aligned"
   - **a notice that has forks add config keys also writes the steps for when the fork already has the same key**: the steps to drop the fork's part and align to upstream's line, and the `git grep` to find it | when fork and upstream add at different spots, git takes both without conflict, so "on conflict" / "add if missing" is not enough (`.notices/README.md`)
   - never write "keep" for fork edits without behavior (comments only etc.) | write that they may be returned to upstream's text (`.notices/README.md`)
   - **a rule key renamed / moved / removed (step 3) → the key table in required_actions**, one line per key: `<old file> <old key> -> <new file> <new key>` (`-> removed` when it is gone, then where its content went)
     - the next step finds the fork's own references: `git grep -n -E '<old key>' -- .claude/rules ':!.claude/rules/core' ':!.claude/rules/items'` (provisional rules ending `(order: <id>)`, `overrides:` lines of project.md, its own rule files) → rewrite each to the new place or drop it
     - a table of many moves (rule keys, README headings, old core file names → new places) uses this same form
   - **moved or renamed → always write `moved:`** (paths from the repo root, directories allowed, `;`-separated)
     - list them without gaps with `git diff --name-status -M <before> <after>` (uncommitted → `git diff --cached -M --name-status`)
     - write `moved:` only when the move-source path is gone (`pnpm check notices` stops a remaining source)
     - while the old path stays as a re-export shim → do not write it; write the new path and how to fix imports in `notes:` and `required_actions`, and write `moved:` in the later notice that removes the shim
     - a deletion with no destination → write the deleted paths and where fork-specific content goes in `notes:`
   - **writing the impact on a specific fork → never guess**
     - in that fork's repo, take the fork-side edits of the files this change touches (move sources included) as a diff and write the result as is: `git -C <fork> diff --name-only $(git -C <fork> merge-base HEAD <fork 内の upstream remote>/<branch>) HEAD -- <files>`
     - empty → `上流ファイルの編集なし`; not empty → file names and `--stat` scale | forks not examined → `not checked`
     - a list of a fork's keys or values (currencies, categories, rules …) → enumerate them from that fork's file with a command and paste the output, never count by hand | write the command beside it so the fork can list them again (`.notices/README.md`)
   - **a change that adds / switches callers of core components, hooks or services (`_screen/*` Screens etc.) puts this standard line in verify**:
     ```
     pnpm typecheck passes including upstream _screen/* default screens even where your page.tsx points to _components/; a failure there = your fork's core edit is not backward compatible (CLAUDE.md CORE_FILES fork_core_edit_compat) — fix the core side, do not edit the upstream Screen
     ```
   - the type check in verify is written `pnpm typecheck` (never `tsc --noEmit`; `.notices/README.md`)
   - **`checkpoint` = a label by default** (English kebab, no clash with existing ones; unsure → `<slug>`) | declares "applying up to this notice puts the fork at a consistent resting point"
     - **a checkpoint is the author's declaration**: upstream does not verify intermediate checkpoints (each fork's /flux checks every segment on its side; only the pushed tip of a `--safe` ship gets the full checks, step 7) | label only a point where you expect the fork to work; a change whose fix lands in a later commit → `checkpoint: -` + notes
       - a checkpoint found broken later (a fork's report) → a fix notice with `fixes:` (and `skip_checkpoint:` when it cannot be picked ahead)
     - `-` only when you can assert "an intermediate point where forks do not work without the following notice", with the reason in `notes:` (e.g. `notes: checkpoint:- because <id> (step 2) is required for the build to pass`) | unsure → never `-`
   - no follow-up work, only a checkpoint or `fixes:` to pass on → `severity: info` + `required_actions: none` + `checkpoint: <label>`
   - put the notice in the same commit as the change it should include in its checkpoint, or a later commit (shipped earlier, the merge target would not contain the change)
3. your own commits before push (`origin/<branch>..HEAD`) may be fixed freely (amend / rebase to fix change and notice)
   - a shipped (pushed) notice's body may be corrected (forks read every notice in its last version, D351) | a correction that needs work from forks that already took it → a new notice with `fixes:`, never only the edit
   - typos, bug fixes and non-working checkpoints → shown by a new notice's `fixes:` (and `skip_checkpoint:` when needed) (`.notices/README.md` sections `修正(fixes)`, `区切りを外す欄`)

## CLEANING UP BODIES
- bodies of notices whose segment closed may be deleted on the upstream side (no deadline; never moved to `done/`; the history keeps the last version)
- notices using migrations / codemods: ship → run on your own DB → delete the attachments and body in the next commit
- a deletion that only cleans up needs no notice (`.notices/README.md` section `本文と添付物の片付け`)
- ledgers do not flow upstream, so upstream does not track application status

language: reply Japanese | notice contents English
