# DOWNSTREAM NOTICE id:20261102-222212-plural-inflection-lib
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:feature/bundle3-ui-docs-tools | commit:- (this commit)
date: 2026-11-02T22:22:12+09:00
severity: action-required
checkpoint: plural-inflection-lib
resolves: 20261028-130747-unify-plural-inflection-lib
change: generator plural guessing moved from hand rules (src/utils/stringCase.mjs toPlural, removed) to scripts/domain-config/domain/plural.mjs toPlural backed by the devDependency pluralize 8.0.0 (last name segment only); domain.json plural stays the explicit override
why: new devDependency must be installed or dc:generate / forge / role:generate fail with module not found; the toPlural export of src/utils/stringCase.mjs is gone
required_actions:
1. pnpm install
2. git grep -n "toPlural" -- src scripts ':!scripts/domain-config' ':!scripts/role-config' → for each hit importing toPlural from utils/stringCase.mjs, import it from scripts/domain-config/domain/plural.mjs instead (scripts only; src runtime code must not import it: pluralize is a devDependency). Checked forks (88-base TriQ __voranowa boardgame-site next-vnx oripa-demo oripa-do-2 oripa-do pandora voranowa) had 0 such hits
3. none unless a word is guessed wrong: set plural in that domain.json; a wrong guess for a relation target name → /order next-starter to add pluralize.addIrregularRule / addUncountableRule in plural.mjs (upstream-owned); never re-add hand rules to stringCase.mjs
verify: pnpm test:dc-plural passes | pnpm dc:generate:all leaves git status unchanged for generated files | pnpm typecheck
manual_steps: -
refs: scripts/domain-config/domain/plural.mjs | scripts/domain-config/tests/plural.test.mjs | scripts/domain-config/README.md (複数形の推定) | order 20261028-130747-unify-plural-inflection-lib
notes: generated output unchanged: pnpm dc:parity against the previous commit with --repo for the 10 forks above = 115/115 match (forks other than boardgame-site stop at the pre-generation checks in both versions); old vs new toPlural over every singular and relation domain in 299 domain.json + profile/role json of the 11 repos = 0 diffs. Guesses differ only for words not used today (box→boxes, status→statuses, person→people, data/media unchanged). spec/collectionField.mjs defaultChildName (drop one trailing s) unchanged
