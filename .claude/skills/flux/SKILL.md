---
name: flux
description: On the downstream (fork) side, take in upstream changes and follow up DOWNSTREAM NOTICEs - fetch → split unapplied notices into segments per checkpoint → overview of all segments + a detailed plan of only the next one (incl. the upstream change sweep and the fork's follow-up) → approval → that segment's merge, code fixes, DB, backfill, verification, ledger, commit, push → present the next segment's plan and stop | Approval per segment; n = n segments at a time, all = without stopping, to POSITION = end the sortie there, light = continue light segments without approval; a segment with a fix (fixes:) ahead stops and says so (a fix upstream marked pick: clean is cherry-picked right after its segment); tells this fork's follow-up state exactly whenever run; the pair of upstream's /ship
argument-hint: "[status | status --chain | relay | intake … | apply … | [<n> | all] [to <checkpoint|commit>] [light] | notice id (省略で 1 区間ずつ止まりながら merge + 適用)]"
disable-model-invocation: true
---

role: as the **downstream (fork)**, take in the upstream repo's changes and handle **DOWNSTREAM NOTICEs** (follow-up notifications, `.notices/*.md`) | used for any upstream → downstream pair (T1→T2, T2→T3 …) | notices are written by upstream's `/ship`; the fields written and read match the schema of `.notices/README.md` | spec detail: `.notices/README.md`

## ATTACHED FILES (must read when the condition hits; never go on without reading)
the following files in this folder hold rules needed only by forks / segments that meet their condition | `→ relay.md` / `→ moved.md` throughout the body point to them
- **`relay.md`** (relay, 3 or more Tiers): read before building segments when any of these hits:
  - the direct upstream is a middle Tier (OWN FORK IDENTITY AND LEDGER 5 below)
  - any notice in the tree (applied ones included) or incoming has `covers:`
  - own `downstream:` is `yes` (OWN FORK IDENTITY AND LEDGER 5 below; declaration missing / wrong → stop there)
  - mode is `status --chain` or `relay`
- **`railroad.md`** (the railroad team tool): mode is `intake` or `apply` → read it before step 1
- **`moved.md`** (porting moves / renames): any notice of the next segment (covers side and covered side included) has `moved:` → read it before that segment's detailed plan (step 2)
- notice id mode (no reconnaissance, no segment building): judge the same conditions for the target notice and this fork; when they hit, read before step 5

## FOLLOW UPSTREAM'S LATEST STEPS (right after fetch, in every mode)
the `/flux` version a fork merged can be many segments older than upstream's, and the more a fork lags the later the fixed steps reach it | so read the **direct upstream's tip version**, not the fork's (in multi-tier, the parent's tip; fleet ships follow the same rule: roles/worker.md LATEST /FLUX)
1. after `git fetch <upstream>`, `git diff --quiet HEAD <upstream>/<branch> -- .claude/skills/flux/ .claude/skills/fmt/` | no diff → go on with this text
2. a diff → read `git show <upstream>/<branch>:.claude/skills/flux/SKILL.md` and from then on **follow that text** (not this one) | attached files it refers to (`relay.md` / `moved.md`, `.claude/skills/fmt/flux-stop.md`, etc.) are also read as upstream's version with `git show <upstream>/<branch>:<path>` | add one line `/flux: upstream <短 sha> の手順で実行` to the first report
3. tools upstream's steps need (scripts, pnpm scripts, tests, files) are missing from the fork's tree or of another version: skip those steps and put them in the report and in FINDINGS FOR UPSTREAM | never stop or fail because of it (the tools arrive with that segment's merge)
4. modes without fetch (notice id given) also do 1-2 when the `<upstream>/<branch>` ref exists | upstream's version cannot be read → go on with this text and write it in the report

## PRINCIPLES
- **derive state from files and history, not events**: "the set of live notices in the tree" − "the set of inherited notices (judged automatically from the fork's founding point, below)" − "the set recorded in own fork ledger" = unapplied | who merged and when does not matter (a manual merge / a merge on GitHub / this command's merge are all the same)
- **plan in detail only the next segment, approve per segment** (default)
  - the remaining segments stay a one-line overview each (material for the human to decide how far to go) | the notice's full text, upstream changes, conflict forecast, porting and fork follow-up spots are investigated and planned **only for the next segment**
  - a width (`<n>`) given at launch → read "next segment" as "next batch" (consecutive segments advanced on one approval; BATCHES below)
  - never read the material of later segments (fills the context and mixes into the decision at hand; later segments' details change with the earlier merges, so working them out ahead has little value)
- **stop at the end of a segment, present the next segment's plan and wait**
  - after approval, run that segment's merge, code fixes, DB operations, backfill, verification, ledger, commit, push with no confirmation in between; when the segment is done, report the result and **the next segment's detailed plan**; STOP: wait
  - `go` to that report = approval of the next segment's plan (still one stop per segment)
  - the only replies at a segment end are the 4: `go` / `go last` / `再計画` / `ここで終える` (`go last` = advance the segment of the shown plan, then end this sortie without making the next plan; GO LAST below | `再計画` = advance nothing, rebuild the next segment's plan and ask again; REPLAN below)
  - how far to go is fixed by the launch arguments (never widen the range again after reconnaissance; to widen, end with `ここで終える` and relaunch with a width)
  - going on without stopping only with `all`; then repeat "plan → execute" per segment (never make the plans together ahead)
  - either way, **hitting STOP CONDITIONS or HEAVY SEGMENTS below, stopping wins** (approval means "go on if it goes as planned", not "push through whatever comes up")
- **advance by segments**: split unapplied notices into segments per checkpoint (`checkpoint:`); per segment complete "merge → apply → verify → ledger → commit → push"
  - **default: 1 notice = 1 checkpoint** (only notices upstream declared as exceptions with `checkpoint: -`, and notices named by a later fix's `skip_checkpoint:`, stay in the same segment up to the next checkpoint; old schema without the field = a checkpoint = the safe side)
  - stopped midway, the fork sits at the previous checkpoint; rerunning continues from there (state is derived by set arithmetic, so no extra record is needed)
- **align the fork clean per segment**: when committing a segment, the fork's code has fully followed that segment's upstream changes | whether a notice exists does not matter (changes upstream forgot to notice too)
  - parts, libs or core usage changed → find every use in the fork and align it to the new usage | never "keep it because the old usage still works" (UPSTREAM CHANGE SWEEP below, step 6)
  - never move to the next segment until aligned (CONDITIONS TO MOVE ON below)
- **segment done**: each item of required_actions is done / not applicable (with reason) / kept → done
  - only 3 kinds may be kept: within a check's scope → a temporary permit with an order id (`open: <項目> | order:<id>`) | outside checks → the human's decision with a reason (`open: <項目> | human:<理由>`) | a migration the human split into another order (`open: <項目> | migration:<自分の受信箱の依頼の id>`, SPLIT A MIGRATION INTO ANOTHER ORDER below)
  - write them in the ledger `notes:`, list them in the next `/flux`'s first report | once settled, delete that `open:` | whether the next segment may start = CONDITIONS TO MOVE ON below
- **never close a segment that fails the ownership check**: a segment whose base has `src/lib/forkOwnership/intake.txt` → after the commit, no push until `pnpm workflow ownership check` gives 0 (step 7c) | settle violations on the spot: move to an intake point / revert / temporary permit (no grace period)
- **approval of the application plan = explicit instruction to run every step, DB operations included** | while this skill runs, this rule wins over general rules like "ask the user for DB operations" | only commands that show an interactive prompt (marked `[user-run]`, db push etc.) cannot be run by Claude → joined by the in-session user run below
- **chat is for humans; scripts and identifiers go to the work memo**: every stop's report is written in the format of `.claude/skills/fmt/flux-stop.md` (step 8) | file names, shas, notice ids, application steps and decision grounds are never put in chat; they go to WORK MEMO below

## CONDITIONS TO MOVE ON (never move to the next segment until all hold)
- check the 4 below one by one, twice: before the commit (end of step 6: 1, 2, 4, and 3 up to the checks) and at the segment end after push (step 4: all 4, before moving to the next segment's plan / merge) | checking before the commit too = finding leftovers before push
- one missing → never move to the next segment (same for default, `<n>`, `all`, `light`, mid-batch) | settle the missing part inside that segment, or stop as a stop condition
- never move on because "the old usage still works" / "fix it later in a later segment" (later notices are written assuming a fork aligned to the earlier spec)
- [ ] **all architecture follow-up done**: the fork's code fully follows that segment's upstream changes (the notice's required_actions, the drift sweep, what UPSTREAM CHANGE SWEEP found, changes without a notice too) | no remaining calls of old APIs, compat shims, dependencies on old names / old paths (step 6 sweep and follow-up)
- [ ] **all data fixes done**: backfills, data migrations, `[user-run]` db:push all run, and the results checked by verify
- [ ] **checks passed and closed**: the segment checks (step 6: the check entry `pnpm check --gate=ship`, typecheck, lint), the notice's verify and the ownership check (step 7c) passed, the ledger written, committed and pushed
- [ ] **only allowed kinds kept**: the 3 of "segment done" above (`order:` = waiting on an upstream change / `human:` = the human's decision with a reason / `migration:` = migration split into another order), written in the ledger `open:` and the work memo `kept_old:` | nothing else kept
- a gap found after push (noticed a leftover at the segment-end check, etc.): never move to the next segment; settle it with an extra commit in the same segment (align the follow-up / run the data fix and verify) → redo the segment checks (step 6) and the ownership check (step 7c) → push → check the 4 again
  - never rewrite pushed ledger lines (write what was settled under `こちらの誤り` in the segment report) | the fix needs a fork-specific judgment → stop as a stop condition

## SPLIT A MIGRATION INTO ANOTHER ORDER (only when the human chooses it)
- guidance: whenever the next segment's plan has fork follow-up `あり`, add the effort estimate (file count, spot count, kind of work, rough labor) and the fixed line about splitting it into another order to move on (flux-stop `fork の追従`) | never judge whether to split; the human chooses
- how to choose: reply `再計画 移行は別の依頼` at a segment end or at the first approval (step 4 REPLAN below) | /flux rebuilds the plan without the migration, adds the range to split and the draft of the order to its own inbox (need / done_when / refs = target files and grep markers), and asks go again; STOP
- what can be split: only follow-up whose old usage still passes the segment checks (step 6), verify and the ownership check | what would stop passing (build breaks, data breaks, stops working by an upstream deletion) is never split; do it in that segment
- after go: before the segment's merge, file the order by the steps of `/order self`; with that id write `open: <項目> | migration:<id>` in the ledger `notes:` and `kept_old: <箇所> | migration:<id>` in the work memo
  - the filed order does not block moving to the next segment even when the migration is unfinished (4th of CONDITIONS TO MOVE ON) | once the order is settled (by handling it), delete the `open:`
- never file it on your own: only for segments where the human replied `再計画 移行は別の依頼` | a different thing from the /order to upstream (FINDINGS FOR UPSTREAM)

## WORK MEMO (where things not put in chat live)
- place: `.flux/memo.md` (outside git; one per worktree) | at every stop (steps 3, 4, final report, stop conditions) **rewrite it whole** | never delete it
- contents:
  - position (HEAD sha, segment k/N, state)
  - segment table (number | checkpoint label | merge target sha | notice id | marks for fix, porting, hotfix)
  - the next segment's script (application steps, conflict forecast, upstream changes and the fork's uses, ownership review judgments, check items, `[user-run]` join points)
  - decision grounds (relay criteria, excluded picked ones, Tier layout, light / heavy judgment)
  - per-segment `aligned:` `kept_old:` (below)
  - for resuming (sha and push state per segment, next merge target, decisions the human made, pending findings)
  - every upstream finding with its grounds and draft order text
- form of `aligned:` / `kept_old:` (keys English; fleet copies them):
  - `aligned: <この区間で新しい上流の仕組みに作り直した fork のコード: 何を → どう(件数)。上流が持つパスから移したものも | none>` (every segment)
  - `kept_old: <古い使い方のまま残したもの・上流が持つパスに残した fork の編集: 箇所> | order:<id>` / `| human:<理由>` / `| migration:<id>` (only when something was kept; conditions = "segment done"; write the same in the ledger `open:`)
- reading: at the start of `/flux`, if the memo's HEAD equals the current HEAD, carry over the previous script and the human's decisions | otherwise ignore it (re-derive state from the ledger and git) | asked "which files conflict?" / "what is the merge target?" → answer from here
- fleet: the PLAN FILE and the aligned / kept_old of `<tk> status` are copied from this memo

## STOP CONDITIONS (win over the run-to-the-end principle)
any of the following during a segment's merge / application → **stop without committing that segment and report** (earlier segments are committed, so the fork stays consistent):
- the upstream change breaks this fork's own logic or data: the merge erases fork behavior / the `[user-run]` db:push diff includes data loss such as DROP or column deletion / the notice's steps touch fork-specific tables or files
- the notice's `required_actions` disagree with reality, verify fails, and the fix is not obvious
- in porting `moved:` (→ moved.md), part of the fork's edits cannot be re-applied to the new paths and the fix is not obvious
- the upstream change itself shows a bug or design problem; taking it as is makes the fork regress
- it contradicts the constraints / business intent in the fork's `.claude/rules/project.md`
- a conflict where the judgment is really split (as before)
- the fork's uses cannot be fully aligned to the upstream change (aligning to the new usage needs a fork-specific judgment / aligning changes the fork's behavior) | never commit silently keeping the old usage
- the segment checks (step 6 check entry, typecheck, lint) fail and the fix is not obvious (known failures excluded: FIXES below)
- the merge result changed files outside the segment's upstream diff (step 5d out-of-segment check; git's rename guess pours upstream files into an unrelated fork directory, deletes fork files, etc.)
- incoming changes to `.claude/rules/lineage.md` touched a key of your own overrides (`overrides:`) (step 5a `lineage-touch.mjs` gives 1)
  - an ancestor changed the rule's content / `(default)`, so confirm with the human whether to keep, fix or delete the override (options: `打ち消しを新しい鍵の行に合わせて直す` / `打ち消しを消して祖先の規則に従う` / `上流に報告して待つ` = fix the override to the new key line / delete it and follow the ancestor's rule / report upstream and wait) | the key lines before / after go to the work memo
- the ownership check (step 7c `pnpm workflow ownership check`) gave 1 (violation) or 2 (unverified) | this stop happens after the commit, before push: keep the segment's commit, do not push, stack the cleanup / fix in extra commits and rerun the check (no `git merge --abort`)

how to stop:
- mid-merge (uncommitted) → `git merge --abort` back to before the segment | mid-application → leave the changes as they are and show what changed
- then present `何を見つけたか / 根拠(ファイル・差分・出力)/ 選択肢(手で直して続行・上記「区間の完了」の条件で残す・上流に報告して待つ)` (what was found / grounds / options; `区間の完了` = "segment done" of PRINCIPLES); STOP: **wait** | never skip or push through on your own
- resume on the user's instruction (same session → by that reply; after closing → `/flux` or a notice id continues from where it was)

## HEAVY SEGMENTS (stop before that segment even mid-`all` / mid-batch)
- heavy segment = in the next segment's plan (the 6 points of flux-stop `次の区間`), fork follow-up is `作り直し` or `判断が要る` / db:push `あり` / downtime `要る` / manual data migration present
- even mid-`all`, **stop before that segment's merge** and get approval (the default flow stops before segments anyway) | a batch (`<n>`) never puts a heavy segment with others: cut the batch before the heavy one, which gets its own approval
- never write `重い` (heavy) in chat | the 6 points let the reader judge | keep the heavy judgment in the work memo and the PLAN FILE
- never stop inside a segment (showing only the porting first) or send it back upstream as a notice-granularity problem | the weight of porting is set by the fork's edits, upstream cannot predict it, and shipped commits cannot be split afterwards | one notice that brought heavy porting → one line in FINDINGS FOR UPSTREAM (d)

## FIXES (a segment with a fix ahead)
upstream writes `fixes: <notice id | commit:<sha>>` in a notice that fixes a bug of an earlier shipment (`.notices/README.md` section `修正(fixes)`) | stopping at the origin's checkpoint means sitting at a point with a known bug
- **matching** (in BUILDING SEGMENTS 5): read `fixes:` of each incoming / in-tree notice | a referenced notice id → that notice's segment; `commit:<sha>` → the segment whose merge-target range (previous segment's merge target → that segment's merge target) contains the commit = the origin's segment
  - the reference is found nowhere → report it (never skip silently) | the reference is an applied / inherited notice, or a commit already an ancestor of HEAD → `修正元は適用済み` (origin already applied)
- **origin unapplied**:
  - mark the origin's segment in the overview with `修正あり: 区間 K の <修正 notice>`
  - at the head of that segment's detailed plan show `この区間の <修正元> は区間 K の <修正 notice> で修正される`, ask in plain text `この区間を進めますか?(1 区間ずつ進める / ここで止める)`; STOP: wait | this stops mid-`all`, mid-`light`, mid-batch too (never passes without approval)
  - when the fix is a PICK-CLEAN FIX below, instead of this question put `直後に <修正 notice> を取る` in that segment's plan (ask this question before push only when it could not be taken)
  - never batch segments together automatically (deployment to production differs per fork and the user knows it; if push goes to production, the user decides whether to stop)
- **what failed in the origin segment's checks**: failures hitting files the fix notice's commit touches (`git diff --name-only <修正 notice の区切り点>^ <修正 notice の区切り点>`; commit given → that commit) may be written in the ledger `notes:` as `既知(修正は区間 K)` and committed (not a stop condition) | other failures as usual
- **never get ahead**: even knowing a fix is ahead, never implement the same fix in that segment (it conflicts at the later merge and leaves a fork-own version)
- **PICK-CLEAN FIX**: a fix notice upstream judged with `/ship` and marked `pick:clean` on its index line (old notices: `pick: clean` in the body; `.notices/README.md` section `修正(fixes)`, part `先に取れる印(pick)`) → cherry-pick it right after taking in the origin's segment, so a broken checkpoint is never pushed | `pick: -` / no field (old notices included) → the current behavior above
  - target: unapplied, right after one of its `fixes:` references became applied (merged / picked in this sortie included), and the fix's adding commit is not yet an ancestor of HEAD | only notices of the direct parent (grandparent notices' `pick:` is not read → relay.md HOTFIX)
    - a fix of a fix is a target only when the earlier fix is applied / picked (upstream's judgment tried it on that tree too)
    - the origin applied before this sortie → take it before the first segment (contained in the first segment's merge target → arrives by merge, do not take it) | several → one at a time in history order
  - plan: in the origin segment's detailed plan, read the fix notice in full and add `直後に <修正 notice> を取る` with its required_actions and verify | that segment's approval doubles as approval of this pick (`all` does not stop either) | a segment with a pick is never a light segment
  - execute: after the commit of the origin segment's step 7b, before 7c, the same as HOTFIX execute 1-3 below (`git cherry-pick -x <修正の追加 commit>` → the fix's required_actions, segment checks, verify → follow-up and ledger in a separate commit; the ledger line has the same form with `picked:`, `notes:` = `pick-clean after <修正元 id>`)
    - then 7c `pnpm workflow ownership check` (the `picked:` part passes) → push with the segment at 7d
  - could not take it:
    - cherry-pick conflict (a conflict only in `.notices/shipped/` follows execute 1 below: take the fork side and continue; it does not count as not taken) → `git cherry-pick --abort`
    - checks / verify failed → undo the unpushed commits this pick made (`git reset --keep <区間の 7b の commit>`; never undo pushed commits)
    - either way, append `pick failed: <理由>` to `notes:` of the origin's ledger line and commit (when the fix is a side commit, that segment later stops at step 5a's side-commit check), ask the "origin unapplied" question above (`1 区間ずつ進める / ここで止める`); STOP: wait | one line in FINDINGS FOR UPSTREAM (b) (passed upstream's judgment but not in the fork)
  - later segments: ids recorded in the ledger are no checkpoints (same as hotfix) | that spot conflicts at a later merge → take the upstream side when the fork has no edit
- **origin applied**: no stop | mark the fix's segment in the overview with `適用済み <修正元> の修正` (a bug may be live in production; material for the user to set priority) | in that segment's detailed plan, look for the workaround of the time in `notes:` of the origin's ledger line and the fork-side diff, and put what becomes unneeded after the fix into the sweep
- **report**: at a segment end / final report, when the current position is past the origin and before the fix, one line `既知の未修正あり: <修正元>(修正は区間 K)。この位置でのデプロイに注意`

## HOTFIX (take it ahead, skipping what is in between)
a notice's commit for which upstream declared `hotfix:` is cherry-picked before the normal segments (`.notices/README.md` section `緊急修正(hotfix)`) | no dedicated command; found by reconnaissance in every mode | only those with a `hotfix:` declaration are taken, never arbitrary commits
- **finding** (in BUILDING SEGMENTS 5): the `hotfix` field of incoming unapplied notices (index line `hotfix:yes`, the reason sentence in the body) | original commit = that notice's adding commit (grandparent notices → relay.md HOTFIX)
- **when not to pick** (one-line reason in the overview): the first segment's merge target contains the original commit (arrives by merge) / every `fixes:` reference is unapplied (the bug is not in that fork yet; the origin's segment follows FIXES)
- **plan**: present the hotfix in the plan before the next segment, reading the notice in full (several → one at a time in history order)
  - stopping: default, `<n>`, `light` get approval here (never a light segment even with `light`); STOP | `all` reports 1-2 lines and goes on | `status` only displays
  - `いいえ` → skip it this time and go to the normal segments (it arrives by a later merge)
- **execute** (do steps 6-8 as follows):
  1. `git cherry-pick -x <元の commit>`
     - a conflict only in `.notices/shipped/` → take the fork side and continue (`git checkout --ours -- <path>`; files the fork lacks `git rm -q -- <path>` → `git cherry-pick --continue --no-edit`) | upstream's index arrives with a later merge and the unapplied judgment reads the upstream tip's index, so the pick does not need it (`.notices/README.md` `先に取れる印`)
     - any other conflict → `git cherry-pick --abort` back, stop and give options (`手で解いて続行` / `この緊急修正を飛ばす` / `元の commit まで区間で進める` = resolve by hand and continue / skip this hotfix / advance by segments up to the original commit); STOP
  2. the notice's required_actions, the segment checks (the same 3 as step 6; the picked tree lacks `scripts/runner/gates/` → skip the entry and write it in the report) and verify
  3. put the follow-up changes and the ledger in a commit separate from the pick commit (so the tier below can take only the pick commit)
     - ledger line: `- id:<id> | date:<ISO8601> | commit:<pick の短 sha> | upstream:<git merge-base HEAD <upstream>/<branch> の完全な sha> | picked:<元の commit の完全な sha> | notes:<…>`
     - never set `upstream:` to the original commit (the ownership check would misread the Tier1 version) | forks with downstream write `relay:` too
  4. step 7c `pnpm workflow ownership check` (content equal to base + pick passes as `picked`) → push → report | a pick has no merge target, so instead of 7c's "skip when there is no intake.txt" decide by:
     - no check (`package.json` lacks `pnpm workflow ownership check`) → skip | write `所有の検査なし(後の区間で届く)` in the report and the ledger notes | do not stop
     - an old check (`git diff --quiet HEAD <upstream>/<branch> -- src/lib/forkOwnership/` shows a diff) → run it, but never stop the pick on 1 / 2 (an old check may not know picks) | write the result in the report and the ledger notes
     - same version as upstream → as 7c (1 / 2 are stop conditions)
     - all of these = the same treatment as the fleet worker's "skip steps of missing / different-version tools, never stop"
- **after the pick**: rebuild the segments (ids recorded in the ledger are no checkpoints) | that spot conflicts at a later merge → take the upstream side when the fork has no edit
- **picked by hand already**: an unapplied notice in the tree whose adding commit is an ancestor of `<upstream>/<branch>` but not of HEAD (not in the ledger) → apply it in segment 0 and write the ledger line in the form above (regardless of `hotfix:`) | confirm the original commit with the line of `git log --grep "cherry picked from commit"`

## LIGHT SEGMENTS (the `light` judgment; only segments planned in detail)
- light segment = a segment meeting all of the following (one miss → not light): no fork follow-up / no db:push / no downtime / no manual data migration / no deviation (0 conflicts forecast, no `[user-run]`, no fork-side change in the notice's required_actions, no backfill) / not a segment whose origin is unapplied (FIXES above) / no pick-clean fix pick
- only segments planned in detail can be judged (next segment, next batch) | never mark the remaining segments of the overview (their material is not read)
- write the light judgment in the work memo and add `light` to the SEGMENTS row of the PLAN FILE (fleet's review counts "the next N segments are light") | never write `軽い` (light) in chat

## FINDINGS FOR UPSTREAM (findings)
- pile what you notice during application into the work memo (all of them + grounds + draft order text)
- at a segment-end report, show by role only **what was newly found in this segment**, with the running total (flux-stop `上流への所見`) | the final report shows all (none → `なし`)
- (e)(f) point at the fork itself; no draft order to upstream for them
- categories:
  - (a) upstream bugs / gaps (problems in the code taken in, missing tests)
  - (b) notice vs reality drift (steps do not fit, verify fails, an unwritten impact appeared) | **an upstream change that needed fork follow-up without a notice** (found by UPSTREAM CHANGE SWEEP below) always goes here as a missing notice (upstream must "ship a notice for changes that need follow-up")
  - (c) fixes this fork needed that look generic enough for other forks to need too (= `/order <上流リポ>` candidates)
  - (d) design concerns
  - (e) neglected temporary permits: entries of `pnpm workflow ownership check --json` whose permit is refresh / expired-resolved / expired-base, and leftovers; the state of the permit requests (checked like `/wen permits`)
    - a line whose request was rejected → show `戻す・受け口へ移す・別の方針で許可し直す` (revert / move to the intake point / re-permit under another policy) as required | the check unusable (base lacks src/lib/forkOwnership) → omit
  - (f) contradictions with the ownership rules in project.md: quote and point at lines of the fork's `.claude/rules/project.md` that disagree with upstream's ownership rules (`src/lib/forkOwnership/README.md`, CLAUDE.md CORE_FILES) (e.g. lines readable as: upstream files / routes may be deleted / renamed, core may be edited directly, things outside intake points may be changed)
    - **never a failure, never fix it** (project.md is the fork's, D34) | no disagreement → `なし`
- before giving a draft for (a)(c), check whether upstream already fixed it: `fixes:` of incoming notices, upstream's not-yet-taken commits on that file (`git log HEAD..<upstream>/<branch> -- <file>`) | fixed → no draft, write `上流で修正済み(区間 K / commit <sha>)`
- each item: 1-2 lines by role in chat | grounds (files, commits, output) and a one-line draft order live in the work memo
- **never file /order automatically** | keep it in a form the user can file from the memo's grounds by typing `/order <上流リポ>`
- the ledger `notes:` holds deviations only; findings go to the report side (the ledger is the fork's record, not addressed upstream)

## OWN FORK IDENTITY AND LEDGER
1. own name = `fork_id: <名前>` of `.claude/rules/project.md` (every repo declares it in one line; form = lowercase, digits, hyphens; reader and rules: `src/lib/forkOwnership/forkIds.mjs`)
   - never derive the name from the origin URL | no line / `-` / wrong form → STOP: have the user decide and declare a name (default candidate = the repo directory name lowercased; names equal to an ancestor's ledger name or a section heading of `src/lib/CATALOG.md` not allowed)
2. own fork ledger = `.notices/applied/<名前>.md`, temporary permits = `.fork-ownership/<名前>.permits.txt`, own section heading in `src/lib/CATALOG.md` = the same name
   - no ledger → treat as a record of zero applied (created at the first application)
   - a ledger, permits or section heading of an old origin-derived name (`<owner>--<repo>`) remains → rename with `git mv` by the steps of the naming notice
3. other names' files in `.notices/applied/` are ledgers of middle Tiers or other forks (came in by merge) | **never mix them with own state** | reading them as reference is fine
4. **middle Tier's name** = `fork_id:` of `.claude/rules/project.md` in the direct upstream's version (`<upstream>/<branch>`) | that version has `.notices/applied/<middle Tier name>.md` → the direct Tier is a middle Tier that itself follows its upstream as a downstream (→ relay.md) | none → the direct upstream is the top (Tier1) and grandparent notices do not exist
5. **downstream presence** = `downstream: yes|none` of `.claude/rules/project.md` (one line in the same section as `fork_id:`; only reader `forkIds.mjs`): `node --input-type=module -e "import { readForkIdentity } from './src/lib/forkOwnership/forkIds.mjs'; const i = readForkIdentity('.'); console.log(i.downstream ?? i.downstreamError)"`
   - `yes` = has downstream (judge relay → relay.md) | `none` = leaf
   - anything else (declaration missing / wrong) → never guess from the text; STOP: have the user add the declaration (`pnpm workflow ownership check` stops as unverified too)

## FINDING THE UPSTREAM
1. look for a remote other than origin with `git remote -v` (usually `upstream`)
2. none → ask the user for the upstream URL; STOP: wait, then `git remote add upstream <url>` and continue (never guess)
3. find upstream's default branch with `git ls-remote --symref <remote> HEAD`

## INHERITED (PRE-FORK) NOTICES (automatic judgment)
a fork starts by cloning the latest code, so **every notice already in the tree at the fork's founding point is applied by definition** (inherited) | not recorded in the ledger; derived from git history on every run and excluded from the unapplied judgment:
1. the fork's first own commit: the head of `git rev-list --reverse HEAD ^<upstream>/<branch>` (= the oldest commit reachable from HEAD but not in upstream) | fetched beforehand
2. **none** (the fork has committed nothing yet) → every live notice in the tree is inherited
3. fork founding point = that commit's first parent (`<first_own>^`) when it has a parent, else (a root commit = born from a GitHub template, etc.) the commit itself
4. inherited set = the index lines at the founding point (`.notices/shipped/*.md`) ∪ the notice ids present in `git ls-tree -r --name-only <fork成立点> .notices/` (both, for forks founded before the index existed; `incoming.mjs` computes it)
5. **shallow clone** (`git rev-parse --is-shallow-repository` is true): history cannot be walked, no judgment possible | say so, propose `git fetch --unshallow <upstream>`, or confirm the inherited range with the user; STOP (never treat everything as inherited on your own)
- never delete inherited notice files (cleaning bodies is the shipping repo's job; deleting downstream may conflict with upstream's cleanup at merge; exclusion by the judgment formula is right)

## MODES ($ARGUMENTS)
- **empty (default)**: FULL FLOW (below) | stop after each segment and wait for the instruction to continue (step 4)
- **`all`**: same as FULL FLOW, but only the first segment's plan gets approval; then repeat "next segment's plan → execute" per segment without stopping to the end (stops at stop conditions and heavy segments) | for when the app need not be checked between segments, or fleet takes the whole run
- **`next`**: same as default (one segment at a time) | accepted as an alias of the old name
- **`<n>`** (integer ≥ 2): width n | plan the next n segments in detail as a "batch", advance them on one approval and stop | the next plan shown on stopping is n segments too (BATCHES below)
- **`to <checkpoint ラベル | commit>`** (end point; combinable with a width: `<n> to <位置>` / `all to <位置>`): end this sortie at the segment reaching that position (the first segment whose merge target contains the commit)
  - the approval width stays as given (none → one segment at a time) | batches and `all` are cut at the end-point segment too
  - mark the end-point segment in the overview and write `今回の出撃の外` for the segments beyond
  - after the end-point segment, make no next plan; give the final report (step 8) and end (a `go` at the segment end does not go further; to continue, launch anew)
  - the position is not in upstream's history → say so; STOP: wait for the human's answer (never guess) | already taken in → report there is nothing to advance this time and end (nothing to take in)
- **`light`** (combinable with a width and `to`: `light` / `2 light` / `to <位置> light`): at a segment end, when the next segment's detailed plan is a light segment (LIGHT SEGMENTS above), continue with that plan without waiting for approval (report 1-2 lines of the segment report and the gist of the next plan)
  - before a segment that is not light, stop as default and get approval (STOP) | the first segment's plan always gets approval | stop conditions, heavy segments and the end point still apply
- **`status`**: state report only | list fetch + unmerged commit count + overview of all segments (one line each, as in step 2) + the results of inherited / ledger matching, then end | **never merge or apply anything** (no detailed plan either)
- **`status --chain`**: report only the relay state per grandparent notice (no merge, no application) | output form → relay.md
- **`relay`**: a middle Tier drafts relay notices bundling the unjudged old notices it applied before relay judgment existed (no merge, no application) | steps → relay.md RELAY MODE
- **`intake [<n> | all] [to <位置>]`** / **`apply <area> to <checkpoint>`**: only inside the railroad team tool (its runtime header) | intake = merge ahead without application, apply = one area's follow-up up to a station | steps → railroad.md
- **notice id / file name**: only that notice; do FULL FLOW from step 5 on (no merge; targets a notice already in the tree; no segment split)

## INCOMING TOOL (incoming.mjs)
- the unapplied judgment, inherited set and segment building (and relay.md's grandparent checkpoint points / covers) are produced mechanically by `.claude/skills/flux/incoming.mjs` of the upstream tip's version
- it reads only the upstream tip's permanent index (`.notices/shipped/*.md`, 1 notice = 1 line) and the history of commits that added notices, not the bodies, so the answer does not change even when upstream deleted bodies of closed segments (`.notices/README.md` section `出荷索引と本文の読み方`)
- run (runs the upstream tip's version like the steps; a self-contained single file, so it works even when the fork's tree lacks it): `git show <upstream>/<branch>:.claude/skills/flux/incoming.mjs > .flux/incoming.mjs && node .flux/incoming.mjs --upstream=<upstream>/<branch> --json` (`.flux/` = the same out-of-git place as the work memo) (cwd = the fork's repo)
- output: per segment number / merge target (`target`; none for segment 0) / label / notices (`id`, `owner` = name of the index it is in, `grandparent`, `point` = checkpoint point, `body` = where to read the body `<足した commit>:<パス>`, `fields` = the line's fields, `covered` = covered ids riding on that notice, `skipCheckpoint`) and `warnings`
- a segment with `offLine: true` (a `脇の commit` line in the human-readable output) = its merge target is not a descendant of the previous position (merge-base of HEAD and upstream / the previous segment's merge target)
  - the shape where a fix was shipped as a side commit off the broken point and merged; appears in forks that did not take (did not pick / could not pick) that fix
  - show that segment in the overview with the label below; it stops at step 5a
    ```
    脇の commit の区間(本線では `mainline` の commit)
    ```
- always read the body (required_actions etc.) with `git show <body>` (the adding commit's version; never substitute the segment's merge target or the upstream tip's version)
- exit 2 = stop (shallow clone, an index line whose adding commit is missing, a checkpoint point not an ancestor of the upstream tip, no fork_id) | pass the reason on as is; never go on as zero unapplied
- exit 3 (no index at the upstream tip) / the tool cannot be obtained with `git show` (upstream from before this tool): proceed by the manual steps of UNAPPLIED JUDGMENT and BUILDING SEGMENTS below (those steps also explain the same rules as the tool)

## UNAPPLIED JUDGMENT (the same rules for in-tree and incoming; with the tool, its output is authoritative)
a notice (a line of the upstream tip's index; for upstream without an index, the body in the tree) is excluded when any of the following holds; the rest are **unapplied**:
- a line of your own index (`.notices/shipped/<自分の名前>.md`) → filed by yourself as upstream | upstream without an index: the repo URL of `from:` equals your origin (ignore ssh / https notation and `.git`)
- contained in the inherited set (automatic judgment above) → treated as applied
- the id is recorded in own fork ledger → applied
- a covered-side id (an id bundled into another notice by `covers:`) → judged by relay.md's rules

## BUILDING SEGMENTS (with the tool, its output is authoritative; below = manual work for upstream without the tool, and the tool's rules explained)
1. split unapplied notices into 2 groups:
   - **in-tree** (`*.md` directly under `.notices/`, excluding `done/` and `applied/`; merged by an earlier partial run but unapplied)
   - **incoming** (`*.md` directly under it among `git diff --name-only HEAD...<upstream>/<branch> -- .notices/`; read the content with `git show <upstream>/<branch>:.notices/<id>.md`)
2. map each incoming notice to its **checkpoint point commit**: normally the adding commit `git log --diff-filter=A --format=%H <upstream>/<branch> -- .notices/<id>.md` (usually one; several → the oldest) | grandparent notices' checkpoint points → relay.md | the `from: commit:` field is reference only, not used for the judgment
3. covered-side notices are no checkpoint points; they go into the covers side's segment (→ relay.md)
4. order the remaining incoming notices by the history order of their checkpoint point commits (position on `git rev-list --reverse --topo-order HEAD..<upstream>/<branch>`; a checkpoint point already an ancestor of HEAD → segment 0)
5. cut segments (for all segments):
   - read here only the lines needed for the checkpoint judgment, `checkpoint:`, `covers:`, `moved:`, `fixes:`, `pick:`, plus `resolves:` (expiring temporary permits) and `hotfix:` (hotfixes) | never the notice's full text
   - incoming: narrow `git show <upstream>/<branch>:.notices/<id>.md` with `grep -E '^(checkpoint|covers|moved|fixes|pick|resolves|hotfix):'` | `hotfix:` present → HOTFIX above
   - **segment 0** = in-tree unapplied notices (no merge needed) | empty → none
   - then walk incoming in history order and **close a segment right after each checkpoint notice** (`checkpoint:` other than `-`, or an old schema without the field; but a notice named by `skip_checkpoint:` of any line of the upstream tip's index counts as `-`)
     - merge target of a closed segment = that checkpoint notice's checkpoint point commit | a `checkpoint: -` notice stays in the same segment up to the next checkpoint (upstream's exception declaration; the reason is in notes:)
   - notices after the last checkpoint (empty if none) + the remaining commits = the **tail segment** | merge target = `<upstream>/<branch>` | even without notices, unmerged commits make a tail segment (merge only)
   - as a result, normally 1 notice = 1 segment | several notices shipped in the same commit give consecutive segments with the same merge target (the merge completes on the first; later ones just say "already up to date"; normal)
6. what each segment holds (overview): number / merge target (short sha, and checkpoint label or `HEAD`) / notice ids contained / commit count up to there / whether `moved:` exists / fix relations (the marks of FIXES above) / the numbers in `resolves:` that hit your own temporary permits (`upreq:` of `.fork-ownership/<名前>.permits.txt`)
   - hit lines expire after that segment's merge (lines whose numbers are all resolved) → show `受け口へ移す・元に戻す` (move to the intake point / revert) in the plan (`.notices/README.md` section `解決(resolves)`; `pnpm workflow ownership check` shows expired-resolved)
   - conflict forecast, move-source edits and upstream changes are **only for the next segment** (the 2 sections below)

## CONFLICT FORECAST (when planning the next segment, read-only)
list the files likely to conflict at the next segment's merge before approval | never change the index or the work tree
1. terms: `base` = `git merge-base HEAD <upstream>/<branch>` (with HEAD at the time of planning that segment) | **fork-side edits** = `git diff --name-only <base> HEAD` | **the segment's upstream-side changes** = `git diff --name-only <base> <区間の merge 先>`
2. git 2.38 or later (`git version`) gives it exactly: `git -c merge.directoryRenames=false merge-tree --write-tree --name-only HEAD <区間の merge 先>` (exit code 1 = conflicts, conflicting files in the output) | `-c merge.directoryRenames=false` = same setting as step 5b's merge, so forecast and reality agree
3. approximation (before 2.38): the **intersection** of fork-side edits and the segment's upstream-side changes (write both to temp files and match with `comm -12`) | state in the plan that it is an approximation (the same file at different spots is actually resolved automatically)
4. add to each file the scale of fork-side edits `git diff --stat <base> HEAD -- <file>` | upstream renames: add the `R` lines of `git diff -M --name-status <base> <区間の merge 先>`
5. put `衝突しそうなファイル(fork 側の編集規模)` and `移動元の編集` (→ moved.md) in the work memo's script | none → `なし` | in chat, only conflicts that need the human's policy, by role, under `逸脱`

## UPSTREAM CHANGE SWEEP (when planning and applying the next segment; with or without notices)
a notice is the minimum line of follow-up, and upstream may forget one | from the next segment's upstream diff itself, pick "changes that affect how the fork uses things", find the fork's uses and put them in that segment's plan
1. range: the segment's upstream diff = `git diff <base> <区間の merge 先>` (`base` as CONFLICT FORECAST 1) | targets: shared parts, libs, hooks, utils, core (`src/components/` `src/lib/` `src/hooks/` `src/utils/` `src/features/core/` etc., what the fork imports)
2. what to pick:
   - deleted / renamed exports, changed types of function arguments, return values, props (new required ones and defaults whose meaning changed included)
   - newly added `@deprecated`, shims kept for compat, alias old names, re-exports of old paths (comments like `互換` / `deprecated` / `legacy` / `旧`, or functions whose body only calls the new name)
   - config / convention changes (config keys, generator output, naming / placement rules) that change how the fork writes things
3. search the fork's uses (fork-side files importing them; grep old names, old paths, old props) | files that came from upstream are not targets (merge aligns them)
4. put `変更点 / fork 側の使用箇所 / 揃え方` in the work memo's script | none → `なし` | overlaps with the notice's required_actions are merged into the notice side | in chat, put them together under `fork の追従` (what, how much, what kind of work, where it may affect)
5. the merge changes the fork-side tree too (conflict resolution, porting), so after that segment's merge do 3 again and close the gap with the plan in step 6 (newly found ones are aligned in the same segment too)
6. changes of copy sources: match the paths of `git grep -n "^// copied-from: "` against the segment's upstream diff, list the hits in the work memo | only the count in chat | never stop

## REVIEW OF FORK EDITS IN UPSTREAM-OWNED PATHS (when planning the next segment)
merge and porting carry the fork's edits as they are | when the destination is upstream-owned, review "may it be placed there" before carrying (never end by just resolving the conflict)
1. targets (only what this segment touches; no audit of the whole fork): files likely to conflict / files the fork edited or added at a `moved:` move source (→ moved.md) / files in the segment's upstream diff that the fork also edits
2. judge by own fork's CLAUDE.md (CORE_FILES, `fork_core_edit_compat`, CODE_PLACEMENT ancestor libs) and `src/lib/CATALOG.md` | fork edits / additions in upstream-owned places (core, non-`.replace` names in `_screen/` `_layout/` of upstream routes, internals of ancestor repos' libs, etc.) → put one of the following in the plan, one by one:
   - a. **move to a fork-owned place**: the whole replacement beside it (`<Name>.replace.tsx`), `_components/`, config values, `<対象>.override.ts` (cron: `task.override.ts`), the fork's own lib, etc. | movable mechanically without changing behavior, with no processing or guard that must not turn into a copy coming along (`.claude/rules/core/extensions.md`) → move it in this segment (step 6)
   - b. **keep it and ask upstream for an extension point**: upstream has no slot, and moving changes behavior or brings processing / guards that must not turn into a copy | keep it in a form meeting `fork_core_edit_compat`, pass it with an order + temporary permit | give a draft `/order <上流リポ>` in FINDINGS FOR UPSTREAM (c)/(d)
   - c. **keep**: only those with a temporary permit line, or decided by the human with a reason | written in the form of "segment done" above (ledger `open:`, work memo `kept_old:`, in chat by role under `区間の結果`)
3. nothing applies → one line `なし` in the work memo's script (not in chat) | something applies → include it under `fork の追従` | which one is decided by the go on the plan (unsure ones → list the options and ask)

## BATCHES (launched with width `<n>`)
- batch = consecutive segments advanced on one approval | width n = the next n segments (fewer if fewer remain; cut at the end-point segment when `to` is given) | cut before a heavy segment (heavy ones alone)
- plan: for each segment of the batch, put step 2's detailed plan separately per segment (notices, application plan, conflict forecast, upstream changes, ownership review) | conflict forecast and uses for the 2nd segment on are computed read-only from the previous segment's merge target (start `git merge-tree` from the previous segment's merge target), with `前の区間の結果しだいで変わりうる`
- approval: in plain text `区間 k〜m/N をこの計画で進めてよいですか?(go / go last / いいえ)`; STOP | go = approval of the plans of every segment of the batch (go last = advance every segment of the batch, then end)
- execute: complete steps 5-7 per segment (commit, push, ledger per segment)
  - from the 2nd segment on, before the merge check it is as planned (HEAD = the previous segment's commit, clean work tree, the likely-conflicting files and the fork's uses equal to the plan) | different → stop there, rebuild the plan from that segment, show the diff; STOP: get approval again
  - stop conditions apply mid-batch as they are
- end of a batch: stop the same as step 4's segment end (the segment report covers every segment of the batch, the next plan = the next batch)

## FULL FLOW
1. **reconnaissance**: `git fetch <upstream>` → unmerged commit count (`git rev-list --count HEAD..<upstream>/<branch>`) → BUILDING SEGMENTS above (up to the overview of all segments) | uncommitted changes in the working tree → report them first; STOP: confirm whether they may be stashed
2. **overview and the next segment's plan**:
   - **overview**: every remaining segment, one line each
     - the work memo's segment table: number / short sha of the merge target / checkpoint label / notice id / marks for fix, porting, hotfix, and the count excluded as inherited
     - chat: only number + Japanese gist + notes that matter for the decision (`区間 13 で修正される`, `移植あり`) (flux-stop `残りの概観`) | it is the human's material for how far to go today, so write nothing more
   - **the next segment's script**: read in full only the notices of the next segment (segment 0 when it exists) (`git show <incoming.mjs の body>`; for upstream without the tool, incoming ones with `git show <upstream>/<branch>:.notices/<id>.md`)
     - turn required_actions into **an application plan mapped onto this repo's reality** (target files, commands, order, `[user-run]` join points, verify steps) and write it in the work memo
     - also put in the script: CONFLICT FORECAST, `移動元の編集` (→ moved.md), UPSTREAM CHANGE SWEEP, REVIEW OF FORK EDITS IN UPSTREAM-OWNED PATHS (above; merge-only segments without notices too), and, with porting, its content (move source → destination per pair, file count, line count, gist of the fork's edits)
     - chat: the 6 points of flux-stop `次の区間` (`変わる点` / `体験の変化` / `fork の追従` / `db:push` / `ダウンタイム` / `手動のデータ移行`, plus `逸脱` when needed), by role
   - **include the drift sweep in the plan**: required_actions are the minimum line | search the whole fork with the notice's changes and markers (grep patterns etc.) and put fork-specific code still on the old spec (not in required_actions) into the plan as target files too
   - zero unapplied and zero unmerged commits → end with `この fork の追随対応はすべて完了しています` | zero unapplied with unmerged commits only → a merge-only plan (one tail segment)
3. **get approval** (on the next segment's plan; for a batch, BATCHES above) | in plain text `区間 k/N をこの計画で進めてよいですか?(go / go last / いいえ)`; STOP | `再計画 移行は別の依頼` is accepted too (step 4 REPLAN)
4. **segment loop**: **complete** steps 5-7 for the approved segment | on failure, never paper over it, stop (the fork stays consistent at the previous checkpoint; rerunning continues from the remaining segments)
   - **segment end** (default):
     - first check the 4 of CONDITIONS TO MOVE ON above (missing → no next plan; settle it in that segment or stop as a stop condition)
     - all hold → redo `git fetch <upstream>`, make step 2's detailed plan for the next segment (overview: only what changed since last time)
     - give step 8's segment report + the next segment's plan and ask in plain text `次の区間 k+1/N をこの計画で進めますか?(go / go last / 再計画 / ここで終える)`; STOP: **wait**
     - go → one next segment with that plan (a batch → the next batch) | go last → GO LAST below
     - finished the end-point (`to`) segment → make no next plan, do not ask, give the final report (step 8) and end
     - `ここで終える` → give the final report (step 8) and end (the rest continues with the next `/flux`; relaunch there to change the width too)
     - `再計画 移行は別の依頼` → do the rebuild of REPLAN below without the migration (SPLIT A MIGRATION INTO ANOTHER ORDER above)
     - any other reply (e.g. `あと 2 区間`) is outside the plan: do not accept it, answer the line below and wait
       ```
       ここで終えて `/flux <n>` で起動し直してください
       ```
   - **GO LAST** (the step-3 approval and the segment-end reply; the same approval as go, tied to the same plan file):
     - check as for go, and advance that plan's segment (a batch → all its segments)
     - when done, no fetch and no next plan; do not ask, give the final report (step 8) and end this sortie (same ending as finishing the end-point `to` segment; the rest continues with the next `/flux`)
     - the check rebuilt the plan → show the rebuilt plan; STOP: get approval again (the earlier go last does not approve the rebuilt plan)
   - **REPLAN** (the step-3 approval and the segment-end reply):
     - `再計画 移行は別の依頼` → in the rebuild below, drop from the plan the part of the fork follow-up that can be split, and add the range to split and the draft order (SPLIT A MIGRATION INTO ANOTHER ORDER above)
     - otherwise = when upstream changed the plan's footing (e.g. the next segment's notice was rewritten after planning) | a segment closed by a checkpoint has a fixed merge target, so the check of "on receiving go" below does not notice it
     - no merge, application or commit | redo `git fetch <upstream>`, rerun `incoming.mjs` (lines added to upstream's index = later fixes / `skip_checkpoint:` change the segments), reread the next segment's notices (`git show <body>`; the body is the adding commit's version and does not change, but the segment's contents may), rebuild step 2's detailed plan
     - show the difference from the earlier plan in 1-2 lines and ask the same question again (step 3: `go` / `go last` / `いいえ`; segment end: `go` / `go last` / `再計画` / `ここで終える`); STOP | the earlier go / go last do not approve the rebuilt plan
     - never redo the report of the segment just finished (step 8) (that segment's result stands)
   - **on receiving go**: HEAD still the previous segment's commit, clean work tree, (when the next segment is the tail segment) the upstream branch head unchanged since planning → all hold → go on with that plan
     - a segment closed by a checkpoint has a fixed merge target, so the plan does not change even when upstream moved ahead | any differs → rebuild the next segment's plan, show the diff; STOP: get approval again
   - `all`: at each segment switch, report `区間 k/N 完了(checkpoint: <label>)` and the gist of the next segment's plan in 1-2 lines, and go on to the next plan → execute without stopping | the next segment is heavy, or its origin is unapplied (except those with a pick-clean fix pick) → stop before it; STOP: get approval | with an end point (`to`), end at that segment
   - `light`: at a segment end, make the next segment's detailed plan; light (above) → report 1-2 lines like `all` and go on without approval | not light → stop as default; STOP: get approval
   - **resumable after the conversation breaks**: the state of stopping at a segment end can be derived from the ledger and git, and step 8's segment report holds the material for the rest, so even after closing the session / compacting, typing `/flux` again continues from the next segment's plan
5. **merge** (skipped for segment 0):
   a. preparation:
      - a `moved:` porting target in the segment → save the diff first (→ moved.md step 2)
      - note the HEAD right before the merge (`git rev-parse HEAD` = `<pre>`)
      - check override contact: `node .claude/skills/flux/lineage-touch.mjs --before <pre> --after <区間の merge 先>` | 1 = incoming changes to `.claude/rules/lineage.md` touched an ancestor key named by your overrides (`overrides:` of project.md / your own section) → do not merge; stop condition (above) | 0 = go on | 2 = cannot read (STOP: say why)
   - **side-commit check** (after a, before the merge): `git merge-base --is-ancestor $(git merge-base HEAD <upstream>/<branch>) <区間の merge 先>` is false (the tool's `offLine`) → do not merge; STOP
     - why: merging makes 2 merge-bases with upstream, so the out-of-segment check (5d), the ownership check (7c) and the next segment's footing cannot be decided (the ownership check is not rebuilt to judge this shape; stop before this segment and choose how to take it)
     - give the ways to take it and wait: (1) pick that fix (same as the execution of the pick-clean fix above; with `pick: -` too, try it on the user's approval; taken → rebuild the segments) / (2) ask the user (e.g. skip this segment and make the mainline commit `mainline` that contains it the next segment's merge target)
   b. `git -c merge.directoryRenames=false merge --no-commit <区間の merge 先>`
      - directory rename guessing is off because it misguesses fork-side deletions / reorganizations as "directory renames", placing upstream's new files into unrelated fork directories or staging deletions of fork files (`-X no-renames` does not stop it)
      - upstream's real directory moves are handled by `moved:` porting | porting targets → port here (→ moved.md steps 3-4)
   c. resolve conflicts yourself (judge how to reconcile upstream's intent with this fork's changes; confirm with the user only those where the judgment is really split) | how to take per-project files:
      - `.claude/rules/project.md` and `behavior.md`: take the fork side; take in upstream's additions only when they apply to this fork
      - `.claude/rules/shortcuts.md` and `term-aliases.md`: above the `fork entries below` marker from the upstream side, below from the fork side
      - generated `src/app/route-map.jsonl` (route map; delete the old `route-map.txt` if it remains): never fix by hand even on conflict
        - take either version, resolve the other conflicts first, finally rebuild with `pnpm generate routes` and `git add` | even without a conflict, rebuild the same way when the segment's upstream diff has this file (the rows of fork-own pages are not in upstream's generated result) | a change inside 5d's allowed set
      - generated `src/registry/district-map.jsonl` (district map; includes the domain list) is treated the same; rebuild with `pnpm generate district-map` (delete the old `src/features/feature-map.txt` if it remains)
      - a middle Tier's file (not in the Tier1 version; you are a lower Tier and the parent fork added it) that you deleted / rewrote, then the parent changed it and it conflicts: keep your (the lower Tier's) judgment (deleted stays deleted, rewritten stays your version)
        - record in the segment report and the ledger `notes:` that the upstream change was not taken in (D30 K7; the ownership check lists these in its reference list of passes)
   d. **out-of-segment check** (mandatory; after c and porting, before the merge commit; read-only):
      - allowed set = `git diff --no-renames --name-only $(git merge-base <pre> <区間の merge 先>) <区間の merge 先>` + the segment's `moved:` destinations (a directory → everything under it)
      - actual changes = `git diff --no-renames --name-only <pre>` (staged and unstaged)
      - add `--no-renames` to both: with rename guessing, `--name-only` shows only the destination, the source (deletion) of an upstream rename drops out of the allowed set and it stops falsely as out-of-segment | with it, the source shows as a deletion and the destination as an addition in both
      - write both to temp files and match with `comm -13` | even one file outside the allowed set → stop condition: `git merge --abort` and show that list as grounds
      - a fast-forward needs no check (no merge guessing)
   e. passed → make the merge commit with `git commit --no-edit` | after the merge, rescan the notices in the tree; a mismatch with the segment's expectation → report and STOP
6. **execute**: carry out the segment's plan in order
   - normal steps: Claude runs them (code fixes, commands like `pnpm generate domain`, backfill tasks, data migrations)
   - sweep and follow-up:
     - align the fork-specific code put in the plan (both the notice's sweep and UPSTREAM CHANGE SWEEP) to the new usage in the same segment; move what REVIEW OF FORK EDITS IN UPSTREAM-OWNED PATHS marked a to a fork-owned place
     - leave no calls of old APIs, no dependencies on compat shims / old names / old paths, no own implementations that became unneeded | what redoing the sweep after the merge finds is aligned in the same segment too
     - alignment needing a fork-specific judgment → stop as a stop condition (the user decided to keep it → write it in `open:` of "segment done" above)
     - only a migration the human split into another order (`migration:`) is not aligned in this segment (SPLIT A MIGRATION INTO ANOTHER ORDER above)
     - follow-up without a notice, and what could not be swept because the notice had no markers → FINDINGS FOR UPSTREAM (b)
   - **segment checks** (every segment, with or without notices, merge-only ones included, always before the commit; the "segment checks" of pick and hotfix are the same; the check items are written only here and the other places point here): run these 3 in order
     1. `pnpm check --gate=ship`: the check entry upstream owns (`scripts/runner/gates/`, the same gate as /ship; every check upstream added to the gate runs: generated files, registries, routes, cron, circular imports, config, notices, rules, etc.; targets the range's changes do not hit are skipped with one line)
        - a segment whose merge-target tree lacks `scripts/runner/gates/` (a version before the entry) → do not run it; write `検査の入口なし(この区間の版には無い)` in the report and the ledger `notes:` and go on with 2 and 3 only
     2. `pnpm typecheck` (whole; not in the entry)
     3. `pnpm exec eslint <files>` narrowed to the files changed in the segment (`.ts` / `.tsx` / `.js` / `.mjs` changed by the merge and the follow-up) (not in the entry)
     - the ownership check runs separately in step 7c (not in the entry)
     - failed → fix it as that segment's follow-up, then commit (in the origin's segment, failures at spots with a fix ahead are not fixed: FIXES above)
     - findings the fork had before the segment are not failures of the segment (when needed, run the same check on the pre-merge HEAD and compare; a target that failed in 1 → run `pnpm check <対象>` by name on the pre-merge HEAD: gate ship skips targets the range's changes do not hit, so running the gate on the unchanged pre-merge HEAD compares nothing)
     - but those among them in upstream-owned files (CLAUDE.md CORE_FILES, ancestor repos' libs) → FINDINGS FOR UPSTREAM (a) (which files, how many + the check's output; likely inherited by every fork)
     - the fix is not obvious → stop condition
   - `[user-run]` steps: ask with the line below; STOP: wait
     ```
     プロンプトに `! <コマンド>` と打ってください
     ```
     - the `!` prefix runs in-session and its output flows into the conversation, so **check the output and judge success** before resuming the rest | failed → never paper over it, present how to handle it
   - run the notice's `verify:` yourself to check | a segment that ported `moved:` also checks the new-path side (→ moved.md step 5)
   - a fork with downstream judges relay after verify (→ relay.md RELAY JUDGMENT; relay needed → draft the relay notice within this segment)
   - **check before the commit**: before step 7, check 1, 2, 4 and the checks part of 3 of CONDITIONS TO MOVE ON above | missing → settle it inside this segment, then go to 7 (never leave it to fix after push)
   - type checking is `pnpm typecheck` | an old notice's `verify:` saying `tsc --noEmit` is read as `pnpm typecheck` (`tsc --noEmit` gives TS2307 on old `.next/**/validator.ts` left by the dev server; see `.notices/README.md`)
   - `pnpm typecheck` fails on **upstream `_screen/*` default Screens own fork does not use** (routes whose page.tsx points to `_components/`, etc.) → the cause is an incompatible core edit of own fork (added required props, deleted core code it does not use, etc.)
     - fix the core side (make added props optional with an empty default again, restore deleted things from upstream); never edit the upstream Screen (CLAUDE.md CORE_FILES `fork_core_edit_compat`, `src/lib/screens/README.md` §7) | write what was restored in the ledger notes
7. **record and commit** (run in a row without confirmation):
   a. append to own fork ledger `.notices/applied/<名前>.md` (create it with the header when missing; English):
      ```
      # APPLIED LEDGER fork:<own origin url>
      - id:<notice id> | date:<ISO8601> | commit:<short sha or -> | upstream:<区間の merge 先の完全な sha> | relay:<none | relay notice id> | notes:<deviations from required_actions, or ->
      ```
      - every fork writes `upstream:` on every line (the upstream version taken in by that segment; never rewrite past lines)
      - `pnpm workflow ownership check` decides the Tier1 version by this field: from the `upstream:` version of the last line of your ledger, to the last `upstream:` of that version's ledger (named by that version repo's `fork_id:`) … until a version without `.notices/applied/` (Tier1) (independent of the number of tiers; multi-tier ownership judgment, `src/lib/forkOwnership/README.md`)
      - align ledger names with `fork_id:` (a ledger with another name at an intermediate version cannot be walked → exit 2)
      - the `relay:` field is written only by forks with downstream; leaf forks omit the whole field | covered-id lines and `relay:` values when recording a covers-side notice → relay.md LEDGER ADDITIONS
   b. commit the diff (application + ledger + relay notices drafted in this segment) (no push yet) | message: a one-line summary + blank line + `downstream-notice: <id>` (every id of the segment, one per line) + the Co-Authored-By trailer the environment specifies | branch handling follows this repo's policy
   c. **ownership check** (only when that segment's merge target has `src/lib/forkOwnership/intake.txt`; none → skip): `pnpm workflow ownership check` | it looks only at the committed HEAD (ledger, temporary permits and cleanup are read from HEAD too), so run it after b's commit, before push | middle Tiers with downstream too
      - 0 → d
      - 1 (violation) → stop condition | no push; show the violation list and settle it (move to an intake point / revert / temporary permit; how: `src/lib/forkOwnership/README.md` section `導入の段階` and required_actions of the cleanup notice `fork-ownership-cleanup`) | stack the cleanup in extra commits, rerun the check, go to d once it gives 0 | never push and close the segment with violations left
      - 2 (unverified) → stop condition | no push; fix the reason (a notice not in the ledger = a missing ledger append / no ledger / no `upstream:` line in the ledger = append it to this segment's line / that sha cannot be walked / no `fork_id:` in the parent's version / a naming declaration problem / no parent remote, cannot fetch it / shallow) | after fixing, commit and rerun the check
   d. push | the segment's merge commit, if unpushed, is pushed with it | push failed → never paper over it, report, and reflect it honestly in the ledger `notes:`
8. **report** (Japanese; at every stop and the final report): read `.claude/skills/fmt/flux-stop.md` and write in that format | chat keeps only the format's sections; script, identifiers, `aligned:` `kept_old:` and resume info go to the work memo (above) | mapping onto the format's sections:
   - `位置`: add the known unfixed one (the report of FIXES above; only when it applies) here
     - at every segment end and in the final report, one safe point line: `pnpm workflow notices safePoint where --remote=<upstream> --at=<the upstream: sha of that segment's ledger line>` → write `セーフポイント: <その出力>`
       - it prints `at safe/<parent>/<tag>` / `past safe/<parent>/<tag> (N commits unverified)` / `before safe/<parent>/<tag>` / `no safe point yet` (it fetches the direct parent's tags and looks only at `safe/<parent fork_id>/*`)
     - exit 2 → `セーフポイント: 未確認(<理由>)` | the tool is missing from the tree → `セーフポイント: 確かめる道具なし(この区間の版には無い)` | a production deploy of the fork needs `at`
   - `区間の結果`: one line whether intake, application and checks (verify / check entry / typecheck / lint / ownership check) went fine and it was pushed | add lines only for exceptions: kept by the human's policy (the content of `kept_old:` by role), our own mistakes, etc.
   - `中継` (forks with downstream, → relay.md): `あり` / `なし` + what downstream must do + why, by role | decision grounds and ids in the work memo
   - `止まった理由` (stop conditions): what was found, grounds, the paths to choose | "how to stop" above
   - `宿題`: `manual_steps` together as a checklist (the only part that is the human's homework)
   - `上流への所見`: this segment's new ones + the running total (FINDINGS FOR UPSTREAM above) | final report: all of them
   - `問い`: in the vocabulary of the stop (steps 3, 4, batches)

## EDGE CASES
(relay ones → relay.md, `moved:` ones → moved.md)
- upstream has no `.notices/` (upstream before this mechanism): run to the end as a normal merge and only report that
- a notice whose schema cannot be read / is broken: skip that notice and include it in the report (never ignore it silently)
- an id in the ledger but not in the tree (upstream cleaned the body / moved it to done/ under the old operation): normal | do nothing
- an unapplied notice with no body in the tree (upstream cleaned the body): normal | handle it by the index line and `git show <body>` (the adding commit's version) | never skip it because the body is missing
- a checkpoint notice's adding commit is already an ancestor of HEAD (merged) but not in the ledger: handle it as in-tree unapplied in segment 0 (no merge needed)
- an incoming notice without the `checkpoint:` field (old schema; no field on the index line either): a checkpoint (the safe side; must not be read as `-`)
- an index line whose notice's adding commit is not in upstream's history (upstream rewrote history / index mismatch): `incoming.mjs` stops with exit 2 | report and STOP (never go on as zero unapplied)
- a segment's merge target is not an ancestor of `<upstream>/<branch>` (upstream rewrote history, etc.): report that and STOP | never fall back to merging everything on your own

## DIALOGUE RULES
- conversation with the user in Japanese | appends to the ledger / notices in English
- **never use AskUserQuestion (the option widget)** | write everything you ask the user (plan approval, merge policy, conflict judgments, options at a stop) **in plain text** and wait for the next message
  - why: in fleet (several forks in parallel), the lead answers by sending plain text through tmux, so a widget cannot be answered | same behavior when run alone, one way of asking
