# DOWNSTREAM NOTICE id:20261029-183829-fieldtype-presenter-for
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-29T18:38:29+09:00
severity: info
checkpoint: fieldtype-presenter-for
change: New `presenterFor(field)` in `src/lib/domain/fields/presenterFor.mjs` decides how a domain.json field is displayed (`{ kind, options? }`, kind = boolean | number | stringArray | enum | string | datetime | date | collectionThumbnails | mediaThumbnail), in the same order the generator used: the table's presenter (enum without options → string), then formInput, then collection, then media, then string. The domain-config presenters generator (`scripts/domain-config/render/presenters/index.mjs`) now only maps that answer to the same expressions as before. The folder `scripts/domain-config/render/presenters/**` left the field-type-guard allowlist (eslint.config.mjs). Test: `pnpm test:presenter-for`.
why: The "what to display with" answer gets one owner in src/lib (council S4). Generated presenters.ts files do not change: `pnpm dc:parity 663d0e11` matches 35/35 (this repo + oripa-do + pandora).
required_actions: none
verify: `pnpm typecheck` | `pnpm lint` 0 errors | `pnpm test:presenter-for`
manual_steps: -
refs: src/lib/domain/fields/presenterFor.mjs, src/lib/domain/fields/presenterFor.test.mjs, scripts/domain-config/render/presenters/index.mjs, src/lib/domain/README.md「何で表示するか」, council report 20261028-234023-field-type-single-interpretation (S4)
notes: No change to any generated file, list rendering or role-config profile presenters (those come in later notices). | Hand-edited presenters.ts entries still win over the generated answer. | No DB change, no db:push.
