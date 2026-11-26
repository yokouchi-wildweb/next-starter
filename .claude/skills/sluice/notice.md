# /sluice attachment: NOTICE COMPOSITION

read when step 5 (commit.md) writes a notice, or a caller writes a notice from a draft (`notices:`) | steps and their numbers: SKILL.md and commit.md

## NOTICE COMPOSITION
1. **get provenance with Bash** (from git and date, as forks read them): repo `git remote get-url origin` (none → `(no remote)`) / branch `git rev-parse --abbrev-ref HEAD` / commit `git rev-parse --short HEAD` (goes into the commit about to be made → `- (this commit)`) / id timestamp `date +%Y%m%d-%H%M%S`
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
   - leave `pick:` out: step 6's pickCheck writes it in the body (the result of trying the fix on the broken point's tree)
   - **`uses:`**: list the migrations (`src/domains/<domain>/scripts/migrations/`) and codemods (`.notices/<id>.<名前>.mjs`) required_actions run, and put them in the same commit | a notice with `uses:` makes `checkpoint:` a label (`-` not allowed) | `pnpm check notices` checks they exist and the checkpoint (`.notices/README.md` section `使う移行・codemod の欄`)
     - the codemod's `<id>` = this notice's, or one its `fixes:` names when the fix replaces that notice's tool (the replacement then counts as the commit's body)
   - **`skip_checkpoint:`**: only when the `fixes:` origin's checkpoint does not work (the fork's checks fail there) and step 6's pick-check gives `-` → write the origin's id (each id must be in `fixes:`; the fix notice itself is a labeled checkpoint) | the origin has `uses:` → cannot be skipped
     - added to the body after the pick-check → `git commit --amend --no-edit -- .notices/<id>.md` → `pnpm check notices` (`.notices/README.md` section `区切りを外す欄`)
   - required_actions, verify and refs of a `fixes:` notice never name paths / scripts missing from the broken point's tree (tools added later etc.) (the fork takes it right after the broken point, so the pick-check's prerequisite check makes it `-`) | to mention later tools, write them in notes (the prerequisite check does not read notes)
   - required_actions of a `hotfix:` notice are written without assuming the changes in between or later notices (the fork applies it skipping them; what its tree lacks the fork's hotfixApply skips and reports as `left-out` / `gap`, never a stop) | never include `pnpm-lock.yaml` or `src/app/route-map.jsonl` in the commit (contents differ per fork; `pnpm check notices` checks)
   - **required_actions = "concrete enough for downstream Claude to run without stopping after one approval"**
     - DB migrations, backfills, regeneration and data migrations all go here | only steps the fork's policy may keep for the human (db push, interactive prompts) get `[user-run]`
     - a step that runs `pnpm task <name>` says whether that task has a dry run (`dryRun: true` in its definition) | write "dry-run first" only for such a task: the runner refuses `--dry-run` on the others
     - regenerate a domain with `pnpm generate domain -- <Domain>` (no prompts by default; no `[user-run]`), naming only the needed categories with `--only` | the fork-side bulk rebuild after adding settings = `pnpm forge`
   - a change that makes forks' existing code drift from the new spec → write markers to find the fork's target code (grep patterns etc.) and the steps to align it to the new spec | never leave compat for forks to sit on
   - split only what cannot be automated into `manual_steps` (fail-auto)
   - **a change that acts on the whole admin** (changing admin shared parts, the admin layout / guard / loader set, the Screen-building API, etc.): never end its notice with regenerating the generated admin (`pnpm generate domain`)
     - forks have hand-written admin pages of domains with `"adminRoutes": false` and `_components/` copied from the generated ones | write the following into required_actions as is:
     - (a) list domains with hand-written admin pages: `git grep -l '"adminRoutes": *false' -- 'src/domains/**/entities/*/entity.json'`
     - (b) list admin files using the changed API: `git grep -l -E '<変えた API の名前>' -- 'src/app/admin/**'` | drop those whose head says `このファイルは pnpm generate domain が生成する` (regeneration fixes them) and those equal to upstream (`git diff --quiet <upstream>/<branch> -- <file>` shows no diff = merge fixes them); the rest = the fork's hand-written ones
     - (c) the steps to align each remaining file to the new form | verify holds `pnpm typecheck` and "the rest of (b) is 0 files, or all aligned"
   - **a notice that has forks add config keys also writes the steps for when the fork already has the same key**: the steps to drop the fork's part and align to upstream's line, and the `git grep` to find it | when fork and upstream add at different spots, git takes both without conflict, so "on conflict" / "add if missing" is not enough (`.notices/README.md`)
   - fork edits without behavior (comments only etc.): write that they may be returned to upstream's text, not "keep" (`.notices/README.md`)
   - **a rule key renamed / moved / removed (step 3) → the key table in required_actions**, one line per key: `<old file> <old key> -> <new file> <new key>` (`-> removed` when it is gone, then where its content went)
     - the next step finds the fork's own references: `git grep -n -E '<old key>' -- .claude/rules ':!.claude/rules/core' ':!.claude/rules/items'` (provisional rules ending `(order: <id>)`, lines marked `(priority)`, its own rule files) → rewrite each to the new place or drop it
     - a table of many moves (rule keys, README headings, old core file names → new places) uses this same form
   - **moved or renamed → always write `moved:`** (paths from the repo root, directories allowed, `;`-separated)
     - list them without gaps with `git diff --name-status -M <before> <after>` (uncommitted → `git diff --cached -M --name-status`)
     - write `moved:` only when the move-source path is gone (`pnpm check notices` stops a remaining source)
     - while the old path stays as a re-export shim → do not write it; write the new path and how to fix imports in `notes:` and `required_actions`, and write `moved:` in the later notice that removes the shim
     - a deletion with no destination → write the deleted paths and where fork-specific content goes in `notes:`
   - **writing the impact on a specific fork → from that fork's git**
     - in that fork's repo, take the fork-side edits of the files this change touches (move sources included) as a diff and write the result as is: `git -C <fork> diff --name-only $(git -C <fork> merge-base HEAD <fork 内の upstream remote>/<branch>) HEAD -- <files>`
     - empty → `上流ファイルの編集なし`; not empty → file names and `--stat` scale | forks not examined → `not checked`
     - a list of a fork's keys or values (currencies, categories, rules …) → enumerate them from that fork's file with a command and paste the output | write the command beside it so the fork can list them again (`.notices/README.md`)
   - **a change that adds / switches callers of core components, hooks or services (`_screen/*` Screens etc.) puts this standard line in verify**:
     ```
     pnpm typecheck passes including upstream _screen/* default screens even where your page.tsx points to _components/; a failure there = your fork's core edit is not backward compatible (CLAUDE.md CORE_FILES fork_core_edit_compat) — fix the core side, do not edit the upstream Screen
     ```
   - the type check in verify is written `pnpm typecheck` (the fork's own type check with its config, not `tsc --noEmit`; `.notices/README.md`)
   - **`checkpoint` = a label by default** (English kebab, no clash with existing ones; unsure → `<slug>`) | declares "applying up to this notice puts the fork at a consistent resting point"
     - **a checkpoint is the author's declaration**: upstream does not verify intermediate checkpoints (each fork's /flux checks every segment on its side; only the pushed tip of a `--safe` ship gets the full checks, step 7) | label only a point where you expect the fork to work; a change whose fix lands in a later commit → `checkpoint: -` + notes
       - a checkpoint found broken later (a fork's report) → a fix notice with `fixes:` (and `skip_checkpoint:` when it cannot be picked ahead)
     - `-` only when you can assert "an intermediate point where forks do not work without the following notice", with the reason in `notes:` (e.g. `notes: checkpoint:- because <id> (step 2) is required for the build to pass`) | unsure → never `-`
   - no follow-up work, only a checkpoint or `fixes:` to pass on → `severity: info` + `required_actions: none` + `checkpoint: <label>`
   - put the notice in the same commit as the change it should include in its checkpoint, or a later commit (shipped earlier, the merge target would not contain the change)
3. your own commits before push (`origin/<branch>..HEAD`) may be fixed freely (amend / rebase to fix change and notice)
   - a shipped (pushed) notice's body may be corrected (forks read every notice in its last version, D351) | a correction that needs work from forks that already took it → a new notice with `fixes:`, never only the edit
   - typos, bug fixes and non-working checkpoints → shown by a new notice's `fixes:` (and `skip_checkpoint:` when needed) (`.notices/README.md` sections `修正(fixes)`, `区切りを外す欄`)
