---
name: ship
description: Ship this repo's changes (fix the range → checks → judge downstream impact → write a DOWNSTREAM NOTICE when needed → commit → push); the pair of the receiving side's /flux | When the user tells you to commit, push or ship, and on /inbox's completion
argument-hint: "[order:<指令 id>] [no-push] [hotfix] [--safe] [--quick] [補足メモ(任意)]"
---

role: **ship** (commit and push this repo's changes; when downstream forks need follow-up work, put a DOWNSTREAM NOTICE in the same commit) | the receiving side is downstream's `/flux`; write notices to match how it reads them | spec: `.notices/README.md`

## WHEN TO USE
- the user tells you to commit, push or ship (`コミットして`, `プッシュして`, `出荷して`) | no instruction → never use it (behavior.md: never commit without an instruction)
- from `/inbox` step 4 (`対応完了`) | the argument `order:<id>` comes with it
- from `/quest` (`--quick no-push order:<id>`: commit only) and its `caravan.md` departure (`--safe` on commits already made: COMMITTED RANGE below)
- also in repos without downstream (leaf forks) | whether downstream exists = the one line `downstream: yes|none` of `.claude/rules/project.md` (only reader: `src/lib/forkOwnership/forkIds.mjs`): `node --input-type=module -e "import { readForkIdentity } from './src/lib/forkOwnership/forkIds.mjs'; const i = readForkIdentity('.'); console.log(i.downstream ?? i.downstreamError)"`
  - `none` → skip steps 3-5 (notice)
  - other than `yes` / `none` (declaration missing or wrong) → never guess from the text; STOP: have the declaration added in the same section as `fork_id:` (`pnpm workflow ownership check` is unverified too)

args: $ARGUMENTS | `order:<id>` = shipping that came from an order | `no-push` = commit only, no push | `hotfix` = ship as an emergency fix (only when the human tells you; never add it on your own judgment, since it cuts into every fork's work) | the rest = extra notes
- `--safe` = a safe ship: the full checks on the tip, and a safe point tag when they pass (only when asked: the human, or an order / plan sheet that says so)
  - use it for legate / guild segment ships and the last ship of a quest | forks stop /flux at a safe point before a production deploy; `--allow-unsafe=<reason>` for emergencies
- `--quick` = a quick ship: skips even the light checks and makes no safe point (QUICK SHIP below)

## STEPS (run in a row without confirmation; stop only on STOP CASES below)
0. **check the order's owner** (only with the argument `order:<id>`): find that id in the output of `node .claude/skills/order/mailbox.mjs inbox`
   - first word `taken` with no `(you)` in `taken_by:`, or `routed` with no `(you)` in `routed_to:` → **an order someone else owns**: warn `<id> は <担当> が持っています`; STOP (avoids shipping twice with another session; the human decides whether to continue; if the human continues, /inbox's resolve needs `--force=<理由>`)
   - not in the list (already done/) → STOP: say so
   - open, or your own → go on
1. **fix the range**:
   - `git status --short` and `git diff --cached --name-only` | other sessions may have staged in the same work tree | ship only the files you changed in this conversation (match them against the files touched in the conversation) | any file you cannot tell → STOP
   - range empty → HEAD has commits the push target lacks (COMMITTED RANGE below) → ship those | none → report only `出荷するものなし` (nothing to ship) and end (no commit, no push)
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
   - always: `pnpm check --gate=ship` | failed → fix and rerun (generator drift → `pnpm generate <target>`)
     - it runs every check of the generators / checkers on gate ship, in order: role, domain, registry, routes, cron, cycles, config, eslint, and the watched rules (pnpm check rules when `CLAUDE.md` / `.claude/rules/` changed), notices (pnpm check notices when `.notices/` or the ship / flux skills changed)
     - targets the watch does not hit are skipped with one line; `--all` runs all | `scripts/runner/gates/README.md`
   - code changed (`.ts` / `.tsx` / `.js` / `.mjs`): `pnpm typecheck` and `pnpm exec eslint <changed code files>`
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
   - you changed your own section of `.claude/rules/lineage.md` (`## <own fork_id>`): a change of rules that act downstream → always a notice
     - wording-only change = `severity: info` + `required_actions: none`
     - deleting / renaming a `(default)` key, dropping `(default)`, or a contract change that needs downstream work → in `required_actions`, write how downstream repos that wrote an override (`overrides: <own fork_id>.<key> = …`) fix it (rewrite to the key's new name, delete the override, etc.; downstream `/flux` stops at a segment that touches an overridden key)
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
   - then **add the index line**: `node scripts/workflow/notices/shippedIndex.mjs add .notices/<id>.md` (one line from the body at the end of your index `.notices/shipped/<fork_id>.md`; never by hand, never edit existing lines; `.notices/README.md` section `出荷索引と本文の読み方`)
   - a repo without its own index yet but with its own notices already (a fork that shipped notices before the index existed) → first `node scripts/workflow/notices/shippedIndex.mjs backfill` (skips notices in the parent's index)
   - then pass step 2's `pnpm check notices` (includes the index check)
6. **commit**:
   - put in only your own files (never sweep in other sessions' staging) | the notice goes in the same commit as the change itself:
     - pass to `git add` only paths that exist in the work tree (passing deleted / move-source paths stops with a pathspec error; stage deletions with `git rm` or include them in the commit pathspec next)
     - include deleted paths and directories in `git commit -- <paths>` (the commit pathspec picks up deletions)
     - before committing, confirm with `git diff --cached --name-only` that only the range's files are in (with a notice, `.notices/shipped/<fork_id>.md` is in too)
   - message in the behavior.md form (subject `<area>: <summary>`, blank line, body = decision record) | with `order:<id>`, a line `order: <id>` after the body | the trailer the environment specifies at the end
   - branch follows behavior.md and the team's policy (already on a feature branch → stay)
   - the change itself was committed already and only the notice was written later → make it the commit right after the change (no other notice commit in between) | not allowed with `hotfix` (change and notice always in the same commit; separate → undo and recombine)
   - a `fixes:` notice included → after the commit, before push, **judge whether it can be picked ahead** (`.notices/README.md` section `修正(fixes)`, part `先に取れる印(pick)`): `pnpm workflow notices pickCheck <this commit>`
     - on a temporary tree that puts only this commit on the broken point (the commit of the origin's checkpoint; other `pick: clean` fixes the fork has picked ahead up to that point go on first), it checks:
       - one commit, no lock / route-map, steps naming no later notice, no cherry-pick conflict, `pnpm typecheck`, `pnpm test scripts/structure/config/moduleLoad.test.mjs`, `pnpm check registry`, the prerequisite check
       - the index lines this commit added are dropped when putting it on; index-only conflicts do not count
     - it writes `pick:clean` or `pick:-` on **that notice's index line** (never in the body; humans never write or rewrite it; no line → it writes nothing and exits 2 = you forgot step 5's add)
     - exit 0 / 1 (clean / -): put the written index in the same commit: `git commit --amend --no-edit -- .notices/shipped/<fork_id>.md` (only your own commit before push; `pick:` does not affect the judgment) → `pnpm check notices` | with `-` too, ship without stopping (the fork receives it by the current fixes behavior) | write the failed conditions in the report
     - exit 2 (cannot judge: origin not in history, dependencies cannot be installed): ship without the field (no field = same as `-`), report `pick 未確認: <理由>`
     - `未実行: <検査>` (the base tree has no script for it) → write in the report
   - with `hotfix`, after the commit, before push, **check that it can be picked** (`.notices/README.md` section `緊急修正(hotfix)`): pass `pnpm check notices` again
     - with `fixes:`, the `pnpm workflow notices pickCheck` above doubles as this check: the reason for `-` is a conflict, a failed check or a dependency on a later notice → no push; STOP (STOP CASES)
     - no `fixes:` → skip it (which version to apply to cannot be decided; report `未確認: 修正元なし`)
     - next, **check the prerequisites hold in lagging forks**: `pnpm workflow notices hotfixCheck <this commit>` | on a tree picked onto each fork's position in fleet.conf (merge-base), it checks that the `paths:` of path-scoped rules this commit added or changed, the `pnpm <script>` of the notice's steps and the paths the notice names exist (not relying on what the changes in between bring)
     - exit 1 → no push; STOP (STOP CASES) | exit 2 (fork position unknown) → report `未確認: 遅れた fork の位置` and go on | a known position can be passed with `--base=<sha>`
   - before push, **with `--safe` only, run the full checks on the tip** (a plain ship runs the area checks above instead and makes no tag; `.notices/README.md` section `区切り(checkpoint)と区間適用`, part `セーフポイント`): `pnpm workflow notices safePoint check`
     - upstream does not check intermediate checkpoints (each fork's /flux checks every segment on its side); only the tip of a `--safe` ship gets the full checks
     - it needs a work tree equal to HEAD and runs on HEAD, in order: `pnpm test` (whole), `pnpm check`, `pnpm typecheck`, `pnpm lint`, `pnpm build`; all pass → it records HEAD as checked (used by step 7's tag)
     - exit 1 (a check failed): fix it in your own unpushed commit (amend; align notice and index line) and rerun | the fix is not obvious → STOP
     - exit 2 (cannot run: uncommitted changes, a check changed tracked files, etc.): report `セーフポイントなし: <理由>` and go on (push without a tag)
7. **push** (not with `no-push`): `git push` | WORKTREE ROUTE below when it applies (always with `--quick`) | failed → never paper over it, report the reason
   - then **tag the safe point** (`--safe` only, when step 6's `safePoint check` passed on this HEAD): `pnpm workflow notices safePoint tag`
     - it confirms HEAD = the pushed `origin/<branch>` (WORKTREE ROUTE: `origin/main`, the tool's default) and HEAD = the sha the check recorded, creates the annotated tag `safe/<own fork_id>/<YYYYMMDD>-<n>` (n = the next free number for that fork_id and day) on HEAD and pushes it (`git push origin refs/tags/<tag>`)
     - exit 1 → no tag; write the reason in the report (the push stands; the next `--safe` ship tags its own tip)
     - a middle tier (`downstream: yes`) tags its own repo the same way (same /ship, same tool, its own fork_id in the tag name)
8. **report** (Japanese):
   - first line = downstream intake verdict (measured): `取り込み判定: 安全 | 要注意(理由)| 危険(理由)`
     - `危険` (danger) = a plain merge breaks the fork's build, boot or existing behavior / needs manual work on the fork side / behavior or permissions change silently | `要注意` (caution) = only as far as merge conflicts may happen | no downstream → omit
   - commit short sha, push target (or why not pushed), check results, the notice id and a summary of change (none written → `notice 不要: <理由>`), the reference of `fixes:` if added, the order id of `resolves:` if added
   - a `fixes:` notice shipped → give the `pick:` judgment (clean / `-` with the failed conditions / unverified)
   - `hotfix` → say it was shipped as an emergency fix, the result of the pick check, and that each fork needs `/flux` (forks do not notice until they run it)
   - the safe point: the tag name, or `セーフポイントなし: <理由>` (plain ship, `--quick`, `no-push`, a full check failed / could not run, the tag step failed)
   - came from `/inbox` → do not stop here, return to the rest of `/inbox` step 4 (RESOLUTION) | use the commit sha and push result there

## STOP CASES
- a file you cannot tell whether to put in the range (may be another session's change)
- a check failed and the fix is not obvious
- in the downstream impact judgment, the notice's required_actions cannot be written concretely enough for downstream Claude to run (the upstream change may be what should be fixed)
- `hotfix` depending on earlier unshipped / unreceived changes, or the pick check (`pnpm workflow notices pickCheck`) reported a conflict or a failed check (show the dependent changes, ask whether to drop hotfix for a normal shipment or remove the dependency)
- `hotfix` where `pnpm workflow notices hotfixCheck` listed things missing from a lagging fork's tree (show that list and ask for a choice: remove the dependency / add to the notice's required_actions what fails in that fork and what to do / drop hotfix for a normal shipment / ship as is)
  - never change a rule's `paths:` just to pass the check (never change it without saying in which files it stops being loaded)
- on stopping: show what you found and the options in plain text; STOP: wait

## QUICK SHIP (`--quick`)
- for a run of small ships where the full checks cost more than they protect | makes no safe point | a run of quick ships is closed by a `--safe` ship (its tip gets the full checks and the tag)
- runs no check except `pnpm check notices` (only when a notice is added or changed): skips step 2 entirely otherwise (`pnpm check --gate=ship` included), step 6's pickCheck / hotfixCheck and full checks, step 7's tag
- keeps: steps 0, 1, 3-5 (notice judgment and writing), commit
- ship route: WORKTREE ROUTE below, required (not in a linked worktree → STOP)

## WORKTREE ROUTE (HQ D176)
- applies: in a linked worktree (`git rev-parse --git-dir` differs from `git rev-parse --git-common-dir`) whose branch has no upstream of its own (`git rev-parse --abbrev-ref @{u}` fails, or prints `origin/main`) | a branch tracking its own remote branch → a plain `git push` of that branch
- never touch the main checkout and never move its local `main` ref (no exception)
- `git fetch origin main` → `git merge-base --is-ancestor origin/main HEAD` must succeed (not → rebase onto origin/main, rerun `pnpm check notices` when it applies; with `--safe` rerun step 6's full checks)
- push with `git push origin HEAD:main` | the push target of this route = `origin/main` (COMMITTED RANGE, the safe point tag)
- any condition fails → STOP

## COMMITTED RANGE (step 1's range is empty, HEAD ahead of the push target)
- the commits on HEAD the push target lacks (`git log --format='%h %s' <target>..HEAD`; target = `origin/main` on the WORKTREE ROUTE, else `origin/<branch>`) = commits made earlier by /ship (e.g. quests' `--quick no-push`, loaded by a caravan): their notices and index lines are in them
- skip: step 0 (the caller answers the orders), steps 2-5, step 6's commit | never with `hotfix`
- keep:
  - each commit in the range that adds a `fixes:` notice → step 6's pickCheck on it (`pnpm workflow notices pickCheck <that commit>`; it writes `pick:` on the unpushed index line) → commit the index change alone: `git commit -m "notices: pick marks" -- .notices/shipped/<fork_id>.md`
  - a notice in the range → `pnpm check notices`
  - `--safe` → step 6's full checks on the tip | plain → step 2's area checks on the range's files (`git diff --name-only <target>..HEAD`)
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
   2. [user-run] <interactive command Claude cannot run (e.g. pnpm db:push) — /flux asks the user to run it in-session via `!` prefix, then continues>
   verify: <how downstream Claude verifies the result itself: query / curl / test command>
   manual_steps: <steps outside Claude's reach (Vercel env vars, external dashboards) | - if none>
   refs: <upstream files / commits / docs / related order id>
   notes: <anything else downstream should know>
   ```
   - `<slug>` = a short English kebab from change | saved at `.notices/<ts>-<slug>.md`
   - never write `pick:` in the body (step 6's pick-check writes it on the index line) | no ` | ` inside values (the index line's separator; `shippedIndex.mjs add` stops)
   - **`uses:`**: list the migrations (`src/features/<domain>/scripts/migrations/`) and codemods (`.notices/<id>.<名前>.mjs`) required_actions run, and put them in the same commit | a notice with `uses:` makes `checkpoint:` a label (`-` not allowed) | `pnpm check notices` checks they exist and the checkpoint (`.notices/README.md` section `使う移行・codemod の欄`)
   - **`skip_checkpoint:`**: only when the `fixes:` origin's checkpoint does not work (the fork's checks fail there) and step 6's pick-check gives `-` → write the origin's id (each id must be in `fixes:`; the fix notice itself is a labeled checkpoint) | the origin has `uses:` → cannot be skipped
     - added to the body after the pick-check → rebuild the pre-push line from the body: `node scripts/workflow/notices/shippedIndex.mjs refresh .notices/<id>.md` (keeps the line's `pick:`; refuses pushed lines; never by hand) → `git commit --amend --no-edit -- .notices/<id>.md .notices/shipped/<fork_id>.md` → `pnpm check notices` (`.notices/README.md` section `区切りを外す欄`)
   - required_actions, verify and refs of a `fixes:` notice never name paths / scripts missing from the broken point's tree (tools added later etc.) (the fork takes it right after the broken point, so the pick-check's prerequisite check makes it `-`) | to mention later tools, write them in notes (the prerequisite check does not read notes)
   - required_actions of a `hotfix:` notice are written without assuming the changes in between or later notices (the fork applies it skipping them) | never include `pnpm-lock.yaml` or `src/app/route-map.jsonl` in the commit (contents differ per fork; `pnpm check notices` checks)
   - **required_actions = "concrete enough for downstream Claude to run without stopping after one approval"**
     - DB migrations, backfills, regeneration and data migrations all go here | only commands that show an interactive prompt (db push etc.) get `[user-run]`
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
     - **a checkpoint is the author's declaration**: upstream does not verify intermediate checkpoints (each fork's /flux checks every segment on its side; only the pushed tip of a `--safe` ship gets the full checks, step 6) | label only a point where you expect the fork to work; a change whose fix lands in a later commit → `checkpoint: -` + notes
       - a checkpoint found broken later (a fork's report) → a fix notice with `fixes:` (and `skip_checkpoint:` when it cannot be picked ahead)
     - `-` only when you can assert "an intermediate point where forks do not work without the following notice", with the reason in `notes:` (e.g. `notes: checkpoint:- because <id> (step 2) is required for the build to pass`) | unsure → never `-`
   - no follow-up work, only a checkpoint or `fixes:` to pass on → `severity: info` + `required_actions: none` + `checkpoint: <label>`
   - put the notice in the same commit as the change it should include in its checkpoint, or a later commit (shipped earlier, the merge target would not contain the change)
3. your own commits before push (`origin/<branch>..HEAD`) may be fixed freely (amend / rebase to fix change, notice and index line; rebuild the index line from the body: `shippedIndex.mjs refresh`)
   - never rewrite the body or index line of a shipped (pushed) notice (`pnpm check notices` stops changes to pushed lines) | a fix notice (`fixes:`) only when fixing a pushed one
   - typos, bug fixes and non-working checkpoints → shown by a new notice's `fixes:` (and `skip_checkpoint:` when needed) (`.notices/README.md` sections `修正(fixes)`, `区切りを外す欄`)

## CLEANING UP BODIES
- bodies of notices whose segment closed may be deleted on the upstream side (no deadline; never moved to `done/`; index lines stay)
- notices using migrations / codemods: ship → run on your own DB → delete the attachments and body in the next commit
- a deletion that only cleans up needs no notice (`.notices/README.md` section `本文と添付物の片付け`)
- ledgers do not flow upstream, so upstream does not track application status

language: reply Japanese | notice contents English
