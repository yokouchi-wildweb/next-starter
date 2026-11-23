# /ship attachment: commit steps (0, 1, 3-6) and QUICK SHIP

read by: /ship (SKILL.md STEPS points here for steps 0, 1 and 3-6) | a caller that only commits (`/ship --quick no-push`, e.g. a team's Seeker) needs this file only, plus notice.md when step 5 writes a notice | steps 2, 7, 8, STOP CASES, WORKTREE ROUTE, CATCH UP, SHIPPED TIP, COMMITTED RANGE: SKILL.md

## STEPS 0, 1, 3-6
0. **check the order's owner** (only with the argument `order:<id>`): find that id in the output of `node .claude/skills/order/mailbox.mjs inbox`
   - first word `taken` with no `(you)` in `taken_by:`, or `routed` with no `(you)` in `routed_to:` → **an order someone else owns**: warn `<id> は <担当> が持っています`; STOP (avoids shipping twice with another session; the human decides whether to continue; if the human continues, /inbox's resolve needs `--force=<理由>`)
   - not in the list (already done/) → STOP: say so
   - open, or your own → go on
1. **fix the range**:
   - `git status --short` and `git diff --cached --name-only` | other sessions may have staged in the same work tree | ship only the files you changed in this conversation (match them against the files touched in the conversation) | any file you cannot tell → STOP
   - range empty → HEAD has commits the push target lacks (SKILL.md COMMITTED RANGE) → ship those | none → plain or `--safe`: SKILL.md SHIPPED TIP | `--quick`: report only `出荷するものなし` (nothing to ship) and end (no commit, no push)
   - **never put migrations kept out of git `src/domains/**/scripts/migrations/*.local.ts` in the range** (emergency data fixes not sent downstream; one `.gitignore` line) | staged or tracked → STOP (gate ship's `pnpm check local-migrations` fails too; remove with `git rm --cached <path>`; needed downstream too → drop `.local` and make it a normal migration with `notice:`)
   - list deletions and renames: the `D` / `R` lines of `git status --short` and files deleted in the work tree | used by the judgment of step 3 and by `moved:`
   - **check for overlap with other sessions' commits**:
     - base = the HEAD at the start of the conversation (latest commit of the environment's gitStatus; none → the HEAD you saw when starting the work)
     - from `git log --format='%h %(trailers:key=Claude-Session,valueonly,separator=) %s' <base>..HEAD -- <range files (deleted ones included)>`, drop this conversation's commits (`Claude-Session:` = this conversation's session URL) | empty → next
     - for each remaining commit read `git show <sha> -- <file>`:
       - a file you deleted or moved, or rewrote whole → carry that change over to the destination (cannot → STOP)
       - a file you only edited in part → confirm with `git diff HEAD -- <file>` that you did not revert that change
     - write what you carried over in the report and the commit body | partial edits keep others' changes naturally since the work tree sits on HEAD; changes get lost only on delete, move or whole rewrite
3. **judge downstream impact** (repos with downstream only): any of the following → a notice is needed | none → write one line `notice 不要: <理由>` in the report and go to step 6
   - deleting / moving files forks may touch (docs, READMEs, registry, config, core parts …) (`.notices/README.md` section `削除・移動は notice と同じ commit で出す`)
   - forks' existing code drifts from the new spec: deleting / renaming exports, changing argument / props / return types, adding or removing config keys, changing generator output, naming or placement conventions
   - manual work on the fork side: `db:push` (tables, columns, indexes), regeneration, env, external preparation, adding / removing / retiming cron (`pnpm generate cron`)
   - behavior or permissions change silently
   - a top-level boolean export of a domain's config.ts (the values gate rules point at with `when`, D28) was removed or renamed: `pnpm workflow notices whenExports` prints each one (base = the push target; nothing printed = none) → the notice carries the old → new table and, in required_actions, how forks fix a rule's `when` that points at it (their `pnpm generate extensions` stops on it)
   - the rules / README of the changed area ask for a notice (conditions in CLAUDE.md, `.claude/rules/core/` or a colocated README saying `→ notice` / `ship .notices`; read those of the changed area to confirm)
   - a fix to something shipped earlier (step 4)
   - renaming / moving / removing a rule key (a `key:` at the head of a line of CLAUDE.md, a core file `.claude/rules/core/*.md`, an item card `.claude/rules/items/**` or `.claude/rules/lineage.md`): forks name upstream rules by key (provisional rules, `(priority)` lines, their own rule files) → always a notice with the key table (NOTICE COMPOSITION)
   - you changed your own section of `.claude/rules/lineage.md` (`## <own repo_id>`): a change of rules that act downstream → always a notice
     - wording-only change = `severity: info` + `required_actions: none`
     - deleting / renaming a key, or a contract change that needs downstream work → in `required_actions`, write how downstream repos that wrote the same key marked `(priority)` in their own context fix it (rewrite to the key's new name, drop the mark, etc.: `git grep -n '<key>' -- .claude/rules ':!.claude/rules/core' ':!.claude/rules/items'`)
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
5. **write the notice** (only when needed; write it out without asking first; NOTICE COMPOSITION, notice.md)
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
     - rewrites only the unpushed range (`<push target>..HEAD`, the same target as SKILL.md step 7 / WORKTREE ROUTE): a notice added and then edited by a later commit of the range is added at that last commit instead (its checkpoint point = the add); commit count, the tip's tree, authors and messages stay
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

## QUICK SHIP (`--quick`)
- for every ship but the last of a session | makes no safe point | a run of quick ships is closed by a plain ship (its area checks take in the unchecked quick files, step 2) or a `--safe` ship (full checks on the tip)
- runs no check except `pnpm check notices` (only when a notice is added or changed), runs the ship generators (below): skips step 2 entirely otherwise (`pnpm check --phase=ship` included), step 6's pickCheck, step 7's full checks and tag
- keeps: steps 0, 1, 3-5 (notice judgment and writing), commit (with the `Ship: quick` trailer), push
- generated outputs (a generator is work, not a check, D357): before step 3, `pnpm generate --phase=ship` — the generators whose watch the range hits rewrite their outputs (a few seconds; nothing changes when they are fresh)
  - put every file it changed into the range (they are this commit's own: a lib config needs its district-map row, a domain.json its generated files), so a quick commit, and a notice's checkpoint on it, never carries a stale generated file
  - with `hotfix`: leave `src/app/route-map.jsonl` and `pnpm-lock.yaml` out (`git restore` them; per-fork contents, the hotfix rule) | it fails (exit 1, e.g. a domain.json error) → fix the source and run it again | the fix is not obvious → STOP
  - why: quick skips step 2, so before this a stale output went out until a later plain ship's checks caught it, and forks stopped at a checkpoint in between got it (order 20261119-111917-district-map-stale-at-ship)
- ship route: anywhere | in a linked worktree → SKILL.md WORKTREE ROUTE when it applies | the main checkout → a plain `git push`
