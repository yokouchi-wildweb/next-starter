---
paths:
  - "src/features/**"
  - "src/registry/**"
  - "scripts/domain-config/**"
  - "src/app/admin/**"
---
# DIRECTORY_STRUCTURE / code_generation
> part of the CLAUDE.md contract (see CORE_RULES): upstream-owned, never edit downstream (gap → /order <upstream>) | FORMAT_RULE applies

code_generation:
- generated (no edit; overwritten on every dc:generate while its generateFiles category is on): entities/, components/Admin*/, components/common/ generated forms/fields/detail modal, hooks/use*\<Domain\>.ts, services/client/\<domain\>Client.ts, services/server/drizzleBase.ts, constants/field.ts, types/field.ts, presenters.ts, app/admin/(protected)/\<domains\>/**/_screen/
- registry: dc:generate appends missing entries to src/registry/ files (schemaRegistry, domainConfigRegistry, adminDataMenu, storagePurposeRegistry AUTO block) and rewrites services/server/domainEntry.ts from apiAccess / useImportExport every run, then regenerates serviceRegistry only
- α: serviceRegistry, schemaRegistry, domainConfigRegistry, adminDataMenu = generated whole by pnpm registry:generate (never edit; no fork region) | after dc:generate run registry:generate (registry:check stops until then) | hand-written menu rows → src/config/ui/admin-global-menu.config.ts | core domainEntry.ts, other extension registries = hand-edited
- fork_region: in src/registry/ (and the other `region` files of src/lib/forkOwnership/intake.txt: room / seed registries) a fork writes only between `// --- fork entries start (upstream never edits inside) ---` and `// --- fork entries end ---` (imports included; several pairs per file OK) | outside the pairs = upstream's | generator blocks (AUTO-GENERATED*) are not fork regions | test: pnpm test:fork-regions (old DOWNSTREAM / 上流は空 / FORK markers fail) | ref: src/lib/forkOwnership/README.md
- write-once (generated when absent, never overwritten): app/admin/(protected)/\<domains\>/**/page.tsx (1-line switch), services/server/\<domain\>Service.ts (compose base + wrappers here)
- hand-owned (never overwritten): files you add under wrappers/, formEntities.ts, any other file you add (other constants/ files, hooks with non-generated names), app/admin/(protected)/\<domains\>/**/_components/
- must hand-edit a generated file → first set its category to false in domain.json generateFiles | ref: scripts/domain-config/README.md
