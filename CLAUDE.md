# CLAUDE.md

> **FORMAT_RULE**: AI agent optimized. No tables, no verbose prose. Use key:value, inline separators (|, ,), bullet points. Keep additions in this style.

## STACK
next: 16 (react 19, app router) | db: drizzle (neon/postgresql), firestore | state: zustand, swr | forms: react-hook-form + zod | ui: tailwind 4, shadcn, radix | auth: firebase-auth + jwt | storage: firebase-storage | http: axios (client), fetch (server)

## CODE_PLACEMENT (3-tier)
domain: src/features/, all including entities
library: src/lib/\<name\>/, all except entities
unit: src/components/, hooks/, utils/, small-scale (multi-file OK)

decision: business domain? → features/ | multi-file feature? → lib/ (needs entities → domain) | unit: UI→components/, hook→hooks/, pure→utils/ | page-only→app/\<route\>/_components/
reuse_check: new utility/feature → confirm no equivalent in existing domains/features before create
deps: lib→lib OK | lib→features NG | features→features(UI): use target hooks (no self-create) | features→features(server): direct OK (no circular)
ref: docs/!must-read/設計思想とアーキテクチャ.md

## ARCHITECTURE (8-layer)
1.Page(app/**/page.tsx): SSR/SSG entry
2.Component(features/*/components): UI
3.Hook(features/*/hooks): state, client only
4.ClientService(services/client): HTTP via axios
5.APIRoute(app/api/**): HTTP interface
6.ServerService(services/server): business logic + DB
7.Entity(features/*/entities): schema, types, drizzle
8.Database: PostgreSQL | Firestore

boundary: Hook/ClientService → HTTP → APIRoute → ServerService | Page(SSR) → ServerService direct OK | Hook → ServerService NG
rules: client axios only | server fetch OK | DB access via ServerService only

## PROXY (replaces middleware)
entry: src/proxy.ts (default export, receives NextRequest) | handlers: src/proxies/
pattern: handler chain — each ProxyHandler returns Response (intercept) or void (pass-through). Final fallback: NextResponse.next()
handlers: maintenanceProxy → demoModeProxy → featureGateProxy → redirectProxy (order matters)
headers: proxy.ts sets x-pathname on request headers → server components read via headers().get("x-pathname")
adding_handler: create src/proxies/\<name\>.ts implementing ProxyHandler → register in src/proxies/index.ts
note: Next.js 16 uses proxy (src/proxy.ts), NOT middleware (middleware.ts)

## DIRECTORY_STRUCTURE
all paths under src/

features/\<domain\>/:
- components/Admin{List,Create,Edit}/ (generated), common/
- entities/: schema.ts(XxxBaseSchema,XxxCreateSchema,XxxUpdateSchema), form.ts(z.infer types), model.ts(TS types), drizzle.ts(DB table)
- services/client/, services/server/{drizzleBase(generated), wrappers/, xxxService.ts}
- hooks/ (generated, ref: CRUD_SERVICE)
- constants/, types/, presenters.ts, domain.json

code_generation:
- generated(no edit): entities/, services/drizzleBase, hooks/, Admin*/, registry/
- customizable: wrappers/, components/**/formEntities.ts, constants/, presenters.ts

shared_src: components(AppFrames/Form/Layout/TextBlocks/Skeleton/_shadcn), hooks, utils, stores, lib, config, registry, proxies

## STORES (zustand)
placement: src/stores/ = app-wide only | domain-specific → features/\<domain\>/stores/
structure: stores/\<name\>/{index.ts, internalStore.ts, useStore.ts}
hierarchy: internalStore → useStore → hooks/useXxx(optional)
rules: state-only (logic in services) | UI side-effects in useStore useEffect | internalStore accessed only from useStore.ts
ref: src/stores/README.md

## DOMAINS
core: src/features/core/, no domain.json, manual. examples: auth, user, wallet, setting, mail
business: src/features/, has domain.json, dc:generate. examples: sample, sampleCategory, sampleTag

commands: dc:init | dc:generate -- \<Domain\> | dc:generate:all | dc:delete -- \<Domain\> | dc:add -- \<Domain\>
config_utils: src/lib/domain/ | getDomainConfig(domain), extractFields(config), getRelations(domain) | client: index.ts, server: server.ts
new_domain_json: MUST read src/features/README.md before creating any domain.json to verify schema format
ref: src/features/README.md

## API_ROUTES
required: routeFactory (createApiRoute / createDomainRoute)
generic: GET|POST / (list|create) | GET|PATCH|DELETE /[id] (get|update|soft-delete) | POST /search, /upsert, /bulk/delete-by-ids, /[id]/duplicate, /[id]/restore | DELETE /[id]/hard-delete
domain-specific: auth/, admin/, wallet/, webhook/, storage/
ref: src/lib/routeFactory/README.md

## CRUD_SERVICE (createCrudService)
operations: create, list, get, update, remove, search, query, upsert, duplicate, restore, hardDelete, bulkDeleteByIds, bulkDeleteByQuery, bulkUpsert, bulkUpdate | drizzle-only: belongsToMany, reorder(id,afterId), searchForSorting(auto-init NULL sort_order) | sorting requires: sortOrderColumn option
conditional: duplicate(useDuplicateButton), restore/hardDelete(useSoftDelete), reorder/searchForSorting(sortOrderField)
note: list is a subset of search — use only for simple full-fetch. for relations, filtering, pagination → use search
hooks: each operation auto-generates a corresponding use\<Op\>\<Domain\> hook (conditional ops generate only when enabled)
hook_naming_exceptions: get→use\<Domain\>, list→use\<Domain\>List, remove→useDelete\<Domain\>
server-only(no hook): query, belongsToMany
hook-only: use\<Domain\>ViewModal(useDetailModal)
extraWhere: search/searchWithDeleted/searchForSorting accept `extraWhere?: SQL` (Drizzle only) for conditions beyond WhereExpr DSL (subqueries, EXISTS, JSONB, etc.). Type: ExtraWhereOption from @/lib/crud/drizzle
extension: 1.check base methods → 2.extraWhere for SQL injection → 3.base.query()+wrappers → 4.custom service
files: xxxService.ts(import only) | wrappers/(CRUD override) | \<other\>/(domain-specific)
firestore_limits: no or | single orderBy | no belongsToMany

## COMPONENTS
placement: multi-domain→src/components/ or AppFrames/ | single-domain→features/\<domain\>/components/common/ | page-only→app/\<route\>/_components/

wrappers (raw HTML NG): div→Layout/{Block,Flex,Grid,Stack} | main→Layout/Main or UserPage | section→Layout/Section | button→Form/Button | input→Form/Input | p→TextBlocks/Para | h2→TextBlocks/SecTitle | skeleton→Skeleton/BaseSkeleton

UserPage: Main alias, wraps \<main\> with containerType, h1 not included

ui_layers:
- page: SSR entry, minimal tags, no hooks
- section_container: \<section\> wrap, call hooks here
- unit_item: display only, no hooks
- interaction_parts: "use client", self-contained, minimal hooks OK
  rule: call hooks at upper layer, pass handlers via props

page_controls: AppFrames/User/controls/ (header/footer/bottomMenu visibility, use in page.tsx)
FieldRenderer: baseFields, fieldPatches, fieldGroups, inlineGroups | onMediaStateChange(MediaState)
FormInputType: textInput, numberInput, textarea, select, multiSelect, combobox, radio, checkbox, stepperInput, switchInput, dateInput, timeInput, datetimeInput, emailInput, passwordInput, colorInput, mediaUploader, hidden, none
ref: src/components/README.md

## ERROR_HANDLING
flow: ServerService throw DomainError → APIRoute JSON{status,message} → ClientService normalizeHttpError → Hook pass → UI err(error,fallback)

## NAMING
components: PascalCase or dir/index.tsx | hooks: useCamelCase.ts | services: camelCase.ts | entities: lowercase files, PascalCase types | routes: kebab-case or (group) | constants: UPPER_SNAKE_CASE | index.ts: re-export only

## PROHIBITED
- client fetch (use axios)
- direct DB in API routes (use ServerService)
- raw HTML when wrapper exists
- direct _shadcn imports (use wrappers: button→Form/Button, input→Form/Input/*, skeleton→Skeleton/BaseSkeleton, etc. | no wrapper? → propose creating one)
- form schemas in entities/schema.ts (use formEntities.ts)
- Hook calling ServerService
- skip normalizeHttpError in ClientService
- manual m2m when belongsToMany available
- re-implement when base CRUD suffices
- edit generated files (use wrappers)
- API routes without routeFactory
- direct asset paths (use utils/assets: assetPath, imgPath, videoPath, logoPath)
- space-y/space-x classes (use Layout/Stack instead. Stack: flex flex-col with gap, space prop accepts Tailwind spacing scale numbers)

## CORE_FILES (approval required)
src/lib/, src/features/core/, src/components/, src/proxy.ts, src/proxies/, scripts/domain-config/, src/styles/config.css, src/styles/z-layer.css
src/config/: value changes OK | structure changes (add/remove keys, type change, rename) require approval

## TOOLS
playwright-mcp: available | use only when explicitly instructed by user

## SCRIPTS
ref: scripts/README.md | claude:test: API connection check (requires ANTHROPIC_API_KEY)
db:query "SQL": execute SQL | db:tables: list tables | db:describe \<table\>: show structure | db:count [table]: row counts

## DOCS
location: docs/ | structure: !must-read/, concepts/, how-to/, core-specs/, troubleshooting/, reference/, self-evaluation/
