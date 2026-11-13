# /flux attachment: relay (3 or more Tiers)

read when the condition of SKILL.md ATTACHED FILES hits | the rules here act **in addition to** SKILL.md's sections of the same name (they never replace SKILL.md's rules) | spec: `.notices/README.md` section `中継(relay)`

## TERMS AND INDEXES
- tool: grandparent-notice judgment, checkpoint points, the covers index and absorbing covered ones are produced by the upstream tip's `incoming.mjs` (SKILL.md INCOMING TOOL) (each notice's `owner`, `grandparent`, `point`, `covered`; grandparent notices without a checkpoint point in `warnings`) | below = its rules, and the manual work for upstream without the tool
- **grandparent notice** = a line of an index that is neither your own index nor the direct Tier's (file name of `.notices/shipped/<名前>.md` = the repo that shipped it)
  - upstream without an index: a notice whose `from:` repo matches neither your origin nor the direct upstream's URL (URL comparison ignores notation differences, as in the unapplied judgment)
  - no ledger with the middle Tier's name (SKILL.md OWN FORK IDENTITY AND LEDGER 4) → do not judge grandparent notices (as before)
- **covers index**: read `covers:` of every index line at the upstream tip (excluding your own index; upstream without an index: the in-tree and incoming bodies) and build `covered id → covers-side id` | the same id covered by several notices → take the covers side earliest in history
- **grandparent notice's checkpoint point** = the commit where that id was recorded in the middle Tier's ledger: the oldest of `git log -S"id:<id>" --format=%H <upstream>/<branch> -- .notices/applied/<中間 Tier の名前>.md` (first with `--reverse`) | never use the ledger's `commit:` field | not found → use the adding commit as the checkpoint point and warn in the plan `中間 Tier が未適用: T1 の生 commit で区切る`
- grandparent notices not covered are split by the `relay:` field of that id's line in the middle Tier's ledger:
  - `relay:none` → the middle Tier judged "no relay needed" by diff (RELAY JUDGMENT below) | apply the upstream notice as is (no note, no mapping)
  - no field (old ledger) → note in the plan `<直上 upstream> からの中継 notice なし。required_actions は中間 Tier の状態を前提に書かれている`, read `notes:` of that id's line in the middle Tier's ledger and map onto this fork's reality
  - `relay:<id>` but that relay notice has not arrived yet → normally impossible, since a relay notice ships in the same commit as the ledger record | if it happens, include it in the report and treat it like the no-field case

## ADDITIONS TO UNAPPLIED JUDGMENT
- a covered-side id is applied when its covers-side notice is applied | covers side unapplied → stays unapplied and is absorbed into the covers side's segment (never applied alone)

## ADDITIONS TO BUILDING SEGMENTS (numbers match SKILL.md's section of the same name)
- 2: a grandparent notice's checkpoint point is not the normal adding commit but the "grandparent notice's checkpoint point" above (the middle Tier's ledger-record commit)
- 3: drop covered-side notices (ids in the covers index) from the incoming order and put them in the covers-side notice's segment (no checkpoint point)
  - covers side already applied → covered side treated as applied too (ADDITIONS TO UNAPPLIED JUDGMENT above) | a grandparent notice whose covers side has not arrived yet cannot be known as covered → treat it as a normal grandparent notice (checkpoint point = the middle Tier's ledger-record commit)
- 5: in the covers-side notice's segment, also list the ids it covers as `covered`
- 6: in the segment's notice list, mark covered ids and grandparent notices as such
- for `moved:` target pairs, combine the `moved:` of both covers side and covered side (`moved.md` step 0)

## HOTFIX (SKILL.md HOTFIX)
- original commit of a grandparent notice's `hotfix:` = the commit the direct Tier picked (`commit:` of that id's line in `git show <upstream>/<branch>:.notices/applied/<中間 Tier の名前>.md`) | never take the Tier1 commit directly
- the direct Tier's ledger has no line (not picked yet) → one line in the overview that it cannot be taken, and go on to the normal segments
- pick-clean fixes (SKILL.md FIXES `pick: clean`) are taken only for notices the direct parent issued | never read a grandparent notice's `pick:` (that mark was tried on Tier1's tree, not the direct Tier's) | when the direct Tier took it ahead, that pick arrives in normal segments in the order of the direct Tier's ledger

## LEDGER ADDITIONS (SKILL.md step 7a)
- after recording a covers-side notice, record each of its covered ids on its own line too (`notes:covered by <covers 側 id>`; never duplicate an id already in the ledger)
- the `relay:` field is written only by forks with downstream (the result of RELAY JUDGMENT below; covered ids get the same value as the covers side) | leaf forks omit the whole field

## STATUS --CHAIN
- state report only (no merge, no application, like `status`)
- one line per grandparent notice: `<id> | 中間 Tier: applied <台帳記録 commit 短 sha> / not applied | relay: covered by <id> / none / not judged | me: applied / unapplied / inherited` (`none` = the middle Tier's ledger says `relay:none`; `not judged` = not covered and no `relay:` field in the ledger)
- last, one line with your own count of unjudged ones as a middle Tier (unjudged of RELAY JUDGMENT below)
- no middle Tier (the direct upstream is the top) → print only `祖父 notice なし`

## RELAY JUDGMENT (forks with downstream only)
as a middle Tier, decide mechanically **by git diffs only** whether applied upstream notices must be relayed downstream (never judge by interpreting the text)
- **target forks**: forks with `tier` root / middle in `repo.json` (read as SKILL.md OWN FORK IDENTITY AND LEDGER 5; only reader `forkIds.mjs`) | `tier` leaf = a leaf fork, does nothing | declaration missing / wrong → never guess from the text; STOP (same item of SKILL.md)
- **target notices**: notices applied in the segment that are not lines of your own index (upstream without an index: `from:` is not your origin; grandparent notices and upstream relay notices included) | a covered id is judged as one with its covers side
- **judgment** (after verify of the segment's step 6, before step 7; per notice | any one of ①-③ hits → relay needed; none hits → `relay:none`):
  - reference points:
    - `Q` = that notice's checkpoint point (the checkpoint point of BUILDING SEGMENTS = `point` of `incoming.mjs`'s output; segment 0 → the adding commit; grandparent notice → the middle Tier's ledger-record commit)
    - `P` = the checkpoint point of the notice right before it in upstream's history (the previous notice's `point`; none → the fork founding point = the output's `forkPoint`)
    - `A` = HEAD right after this segment's step 5 (the merge commit; fast-forward → where it arrived; segment 0 → HEAD at the segment start)
  - ①② come from the script (never compare hunks by hand): `node .claude/skills/flux/relay-check.mjs --p <P> --q <Q> --applied-from <A>` | exit 0 = neither ① nor ② | 1 = hit (`overlap:` / `outside:` lines are the grounds) | 2 = error (stop as a stop condition)
  - **① hunk overlap**: the line ranges upstream changed P→Q and the line ranges where the work tree differs from Q overlap or touch in the same file
    - touching counts too, to match the standard that git's 3-way merge treats as a conflict | files upstream added / deleted and binaries count as whole-file ranges
    - fork-own additions far away in the same file (fork scripts in package.json, fork entries in registries, etc.) do not count
  - **② changes outside upstream-changed files in the application work**: files changed from `A` to the work tree (untracked included) that upstream did not change P→Q (this segment's sweep, renames, etc.) | every notice of the segment counts as a ② hit (a segment is normally 1 notice)
  - **③ deviation from required_actions**: in this segment, some required_action of that notice was not run, or was run changed (exactly the deviation written in the ledger `notes:` in step 7a) | regardless of diffs
    - why: without deviation, downstream gets by with the upstream notice's work; with one, downstream would run upstream's steps as they are | `covered by` and push-failure records do not count as deviations
  - excluded: `.notices/`, lock files (`pnpm-lock.yaml` etc.; derived from package.json), per-fork convention files (`.claude/rules/project.md`, `behavior.md`; each fork keeps its own version, never reaching downstream) do not count in ①② | marker files (`shortcuts.md`, `term-aliases.md`) share the part above the marker with upstream, so they count
- **drafting the relay notice** (one or more notices in the segment need relay): one per segment, written to `.notices/<ts>-relay-<slug>.md`
  - composition rules = RELAY NOTICE COMPOSITION below (`covers:` = the ids needing relay in this segment and their covered ids)
  - also put the judgment grounds as they are in `notes:`: ① the script's `overlap:` lines (files and line ranges), ② the `outside:` lines, ③ the deviation written in the ledger `notes:`
  - include the draft in this segment's application commit (the relay notice's adding commit = the ledger-record commit, so downstream's checkpoint point matches)
- **ledger**: in step 7a write `relay:none` or `relay:<中継 notice id>` on each id's line
- **report**:
  - chat: under flux-stop's `中継` section, `あり` / `なし` + what downstream must do + why, by role (e.g. `fork が既定を変えた画面スイッチの設定が上流の変更と重なるため、下流も値を見直す必要がある`)
  - notice ids, relay ids and grounds (`①<files> / ②<files> / ③逸脱`) go to the work memo
  - with a relay notice created, add `中身は判定根拠・台帳 notes から組み立てた下書き。下流へ出す前に確認・編集してよい`
- **limits of the judgment** (being mechanical): ② also catches fork-side changes the notice's own steps produce (regenerating fork domains by pnpm generate domain, etc.) (a false positive on the safe side rather than a miss)
  - shapes where fork lines sit right next to upstream's change, like marker files, are caught by ①'s touching | changes depending on each other semantically with distant line ranges are not caught
- **unjudged** (old ledger lines from before this mechanism):
  - ids of your ledger with no `relay:` field, not lines of your own index, and in no `covers:` of your own index's lines (inherited ids and ids with no line in any index excluded; versions without an index check the same by: `from:` is not your origin / `covers:` of notices from your origin / no notice file)
  - one or more → one line in the report:
    ```
    中継未判定の旧 notice が N 件あります: <id>, ...。`/flux relay` で中継 notice を下書きします
    ```
  - **while unjudged is not 0, flux is not done** (a reason to stop, not advice; CLAUDE.md DOWNSTREAM_NOTICES relay): close it by running `/flux relay` in the same sortie, or else never report completion | 0 → print nothing
- **relay forgotten** (the segment's commit lacked the relay draft / the judgment was skipped) noticed → in the next commit, put the relay judgment and draft before any other work

## RELAY NOTICE COMPOSITION
- rules shared by drafting in RELAY JUDGMENT and RELAY MODE below | schema and general writing rules: `.claude/skills/ship/SKILL.md` NOTICE COMPOSITION (English, machine-to-machine file, written out without asking first)
- never guess the material; collect it from:
  - the upstream notice body (change / required_actions / moved / verify)
  - `notes:` of that id's line in your ledger (deviations, ported moves, resolved conflicts, added hooks, etc.)
  - the commit recorded in the ledger: the first of `git log -S"id:<id>" --reverse --format=%h HEAD -- .notices/applied/<名前>.md` | that commit and the merge commit right before it = the "resolved point" downstream receives
  - your edits to upstream files that hit files that notice touched: `git diff --stat <upstream>/<branch> HEAD -- <notice が触ったファイル>` (spots where downstream receives this fork's version)

composition:
- `covers:` = ids passed from RELAY JUDGMENT (relay mode: every unjudged id, in history order)
- `moved:` = every covered one's `moved:` + the moves you made in the relayed work (check with ledger notes and `git diff -M --name-status`)
- `fixes:` = the covered side's `fixes:`, if any, included (so downstream /flux can read fix relations ahead)
- `change:` = `<自分> applied N <上流> notices: <id> in <sha>, ...` + your side's diffs that affect downstream (port destinations, your own moves, new extension points)
- `why:` = what remains, seen from downstream (upstream's code work is done in this fork; what remains is downstream's own customizations, old-path references, etc.)
- the first 2 lines of `required_actions:` are **always** the following (compat for old /flux that does not know `covers:`; a no-op for new /flux):
  ```
  1. Merge <自分の repo> up to THIS notice's commit in ONE segment; do NOT stop at the covered notices' commits (<covered 側の上流 commit 短 sha 列>) — they are raw <上流> commits without <自分>'s conflict resolutions.
  2. Record THIS notice and the covered ids (<id>, ...) in your own ledger .notices/applied/<your repo_id>.md (notes for covered ids: "covered by <this id>"); do not edit .notices/applied/<名前>.md.
  ```
  then the work of the upstream notice's required_actions that also remains downstream, rewritten for this fork's state (port destinations, your own paths)
- `verify:` = the covered side's verify items meaningful downstream + this fork's verification results (only numbers actually taken)
- `checkpoint:` = a label is required (a relay notice is one resting point for downstream)
- `refs:` = the covered upstream notice paths, the ledger-record commit, your ledger path
- after writing, pass `pnpm check notices`

## RELAY MODE (`/flux relay`)
close **unjudged** old notices applied before relay judgment existed by bundling them into a relay notice (their reference points are old, so no diff judgment is possible) | no merge, no application
1. no own fork ledger (SKILL.md OWN FORK IDENTITY AND LEDGER) → report `中継対象なし` and end
2. compute the unjudged ids (unjudged of RELAY JUDGMENT above) | 0 → report `未判定の notice はありません` and end (write nothing)
3. write them out as one relay notice by RELAY NOTICE COMPOSITION above | old notices cannot be judged mechanically, so cover them all, those without follow-up work included
4. report: the written path and the covered ids, with `中身は台帳 notes と commit から組み立てた下書きなので、確認・編集してからコミットしてください(コミットは /ship)` | ids put in covers drop out of unjudged (the ledger is not rewritten)

## EDGE CASES
- an id in `covers:` is in no index at the upstream tip (upstream without an index: nowhere among the live ones and `done/` in the post-merge tree): include that id in the report (never skip silently) | applying the covers-side notice itself goes on; that id is not recorded in the ledger
- a grandparent notice's middle-Tier ledger-record commit is later than the covers-side notice's adding commit: extend the covers side's segment merge target to that record commit (the latest point in the segment becomes the merge target)
- a notice from your own origin has `covers:` (a relay notice you issued): out of the unapplied judgment as before | not put in the covers index; used only to compute RELAY JUDGMENT's unjudged
- in RELAY JUDGMENT, no upstream-changed files between `P` and `Q` (a checkpoint-only notice with `severity: info`, etc.): ① no hit | if ② ③ do not hit either → `relay:none`
- the segment stopped on a stop condition: its notices are not recorded in the ledger, so no relay judgment either (judged on resuming)
