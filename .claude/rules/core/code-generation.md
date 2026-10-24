---
paths:
  - "src/features/**"
  - "src/registry/**"
  - "scripts/domain-config/**"
  - "src/app/admin/**"
---
# DIRECTORY_STRUCTURE / code_generation
> part of the CLAUDE.md contract (see CORE_RULES): upstream-owned, never edit downstream (gap → /upreq) | FORMAT_RULE applies

code_generation:
- generated (no edit; overwritten on every dc:generate while its generateFiles category is on): entities/, components/Admin*/, components/common/ generated forms/fields/detail modal, hooks/use*\<Domain\>.ts, services/client/\<domain\>Client.ts, services/server/drizzleBase.ts, constants/field.ts, types/field.ts, presenters.ts, app/admin/(protected)/\<domains\>/**/_screen/
- registry: dc:generate appends missing entries to src/registry/ files and rewrites the domain's serviceRegistry line from apiAccess every run | everything else in src/registry/ (CORE DOMAINS block of schemaRegistry.ts, extension registries) = hand-edited
- write-once (generated when absent, never overwritten): app/admin/(protected)/\<domains\>/**/page.tsx (1-line switch), services/server/\<domain\>Service.ts (compose base + wrappers here)
- hand-owned (never overwritten): files you add under wrappers/, formEntities.ts, any other file you add (other constants/ files, hooks with non-generated names), app/admin/(protected)/\<domains\>/**/_components/
- must hand-edit a generated file → first set its category to false in domain.json generateFiles | ref: scripts/domain-config/README.md
