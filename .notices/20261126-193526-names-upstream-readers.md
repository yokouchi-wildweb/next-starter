# DOWNSTREAM NOTICE id:20261126-193526-names-upstream-readers
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:(this commit)
date: 2026-11-26T19:35:26+09:00
severity: action-required
checkpoint: names-upstream-readers
fixes: 20261126-160000-registration-kit
pick: clean
resolves: 20261126-161230-names-mjs-also-rewrite-or
change: .notices/20261126-160000-registration-kit.names.mjs also reads its notice's moved: rows (_template aside): a row whose old file is gone and new file exists (upstream's kit file, already moved when the segment was taken in) is a move with no write / remove, so the reader pass rewrites (or stops on) the fork's readers of the old path: path + the renamed export (base → <registration>Base; the auditLog split: auditLogBase / auditLogFailedBase each from its own file); generated files are listed only when they would need a change (the generator rebuilds them)
why: the tool planned only the fork's own kit files, so a fork file importing an upstream kit file the segment had moved (e.g. { base } from @/domains/core/user/services/server/drizzleBase) was neither rewritten nor stopped, and typecheck broke after the tool said done (boardgame-site)
required_actions:
1. a fork that already ran the names tool: rerun its plan `npx tsx --import ./scripts/runner/preload/serverOnly.mjs .notices/20261126-160000-registration-kit.names.mjs` (it now prints `上流の移し済み(読み手だけ書き換える): <n> 本` and the readers it rewrites)
2. fix each stop it prints as registration-kit's steps say (a namespace import, an export from or an import() of a renamed export, a new name already bound in the reader), rerun step 1 until it prints no stop
3. `npx tsx --import ./scripts/runner/preload/serverOnly.mjs .notices/20261126-160000-registration-kit.names.mjs --write`, then `pnpm generate registry`
4. a fork that has not run the names tool yet: run it as registration-kit says (this fix is already in the tool)
verify: a rerun of step 1 prints 0 reader rewrites; `git grep -n -E "services/server/(drizzleBase|firestoreBase)\"" -- src scripts tests` shows no import of an upstream base that moved; `pnpm typecheck` passes
manual_steps: -
refs: .notices/20261126-160000-registration-kit.names.mjs (addUpstreamMoves, UPSTREAM_SPLITS); .notices/20261126-160000-registration-kit.names.test.mjs; .notices/20261126-160000-registration-kit.md moved:; order 20261126-161230-names-mjs-also-rewrite-or
notes: upstream's plan reads 69 already-moved upstream rows and writes nothing (0 moves, 0 reader rewrites). Rows whose new path a later segment moved again (e.g. sampleImage into sample) are skipped where the new file is not in the tree; a fork runs the tool at the registration-kit segment, where they exist. No DB change; rule keys: none renamed or removed
