# DOWNSTREAM NOTICE id:20261019-140501-eslint-template-ignores
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:(change ships in the commit that contains this notice)
date: 2026-10-19T05:05:01Z
severity: info
checkpoint: eslint-template-ignores
change: eslint.config.mjs only. (1) The 5 generator-template files whose placeholders are not valid TypeScript (`src/app/admin/_template/__domains__/[id]/edit/_screen/Admin__Domain__EditScreen.tsx`, `.../new/_screen/Admin__Domain__CreateScreen.tsx`, `src/features/_template/components/Admin__Domain__List/Table.tsx`, `Table.withDetailModal.tsx`, `src/features/_template/services/server/drizzleBase.ts`) are added to the global `ignores`, file by file. (2) `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps` are off for `src/features/_template/hooks/**` (placeholder names like `use__Domain__` cannot satisfy hook naming). The other 41 template files stay linted (style-tokens, client-service-boundary, span-in-heading).
why: These 5 parse errors + 3 react-hooks errors appeared on every lint run in every fork and could not be fixed downstream, so the lint exit code could not gate CI or a /flux verify. Ignoring the whole template dirs was rejected: it would drop the 41 parseable templates from the raw-palette / ClientService checks and rely on the sample domains being regenerated in sync (nothing tests that).
required_actions: none. If your fork added its own ignores for these template paths, you may drop them after the merge.
verify: `pnpm eslint src/features/_template src/app/admin/_template` exits 0.
manual_steps: -
refs: eslint.config.mjs (global ignores + _template/hooks block), upstream-request 20261018-201917-eslint-template-parse-errors
notes: `eslint .` still exits non-zero upstream because of the pre-existing react-hooks errors in normal source (about 70 in 46 files, tracked separately); this notice only removes the template-originated ones. A future template that fails to parse will show up as a parse error again; add it to the same ignore list.
