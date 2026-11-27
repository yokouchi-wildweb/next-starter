# DOWNSTREAM NOTICE id:20261127-094033-domain-check-gaps
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:54d7c6f43
date: 2026-11-27T09:40:33+09:00
severity: info
checkpoint: domain-check-gaps
change: The domain preflight (`pnpm generate domain` / `pnpm forge`) now stops, for registrations that generate (generate not false), on: a missing `label` or `idType`; a mediaUploader field without `slug` (camelCase) or `mediaTypePreset`; `singular` / `plural` / a relation's `domain` not in snake_case (was a warning). src/domains/README.md API: `relations` and `fields` are optional (omitted = []), and the required keys are those of generated registrations. The field type table (src/lib/domain/fields/fieldTypes.mjs) gains the attributes `foreignKey` and `idTypeOf`, which replace the fieldType name lists in the relations check and the collection child builder
why: the checks and the written rules disagreed in four places (research tooling.ns-cluster5-after-shelf Q1 2-5, D491); a missing label or idType made the generator silently write a PascalCase label or a text id
required_actions: none
verify: -
manual_steps: -
refs: scripts/structure/domain/checks/required.mjs, scripts/structure/domain/checks/media.mjs, scripts/structure/domain/checks/names.mjs, scripts/structure/domain/checks/relations.mjs, scripts/structure/domain/render/collections/childDomainConfig.mjs, src/lib/domain/fields/fieldTypes.mjs, src/domains/README.md (API)
notes: Checked with the new checks over the generated registrations of next-starter (4), oripa-do (4), boardgame-site (12) and pandora (0): 0 hits. A fork whose own generated registration stops: add the key the message names to that entity.json (label = the admin display name, idType = the primary key type it already has in the DB, slug / mediaTypePreset as the README table says, snake_case names) and rerun `pnpm forge`. Registrations with generate: false are not checked. Fork-specific impact beyond these: not checked.
