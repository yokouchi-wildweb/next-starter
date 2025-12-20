# CLAUDE.md

## WORK_RULES (HIGHEST_PRIORITY)
- work_only_on_instructed_scope: true
- no_preemptive_implementation: true
- planning_and_implementation_separated: true
- await_approval_before_implementation: true
- propose_before_modifying_core_files: true
- language_for_comments_and_docs: japanese
- cross_domain_awareness: before implementing, check if other domains need changes. proactively propose changes in the correct domain rather than placing logic in the wrong domain for convenience

## STACK
next: 16 (react 19, app router)
db: drizzle (neon/postgresql) | firestore
state: zustand, swr
forms: react-hook-form + zod
ui: tailwind 4, shadcn, radix
auth: firebase-auth + jwt
storage: firebase-storage
http_client: axios (client-side only, never fetch)

## ARCHITECTURE (8-layer, strict)
```
1. Page (app/**/page.tsx) -> SSR/SSG
2. Component (features/*/components) -> UI
3. Hook (features/*/hooks) -> state
4. ClientService (features/*/services/client) -> axios
5. APIRoute (app/api/**) -> HTTP interface
6. ServerService (features/*/services/server) -> business logic + DB
7. Entity (features/*/entities) -> schema, types, drizzle/firestore
8. Database -> PostgreSQL | Firestore
```

RULES:
- client-side: axios only (no fetch)
- db access: only via ServerService (never in API routes directly)
- page layer: can call ServerService (SSR context)
- hook layer: cannot call ServerService (client context)

## DIRECTORY_STRUCTURE

### features/<domain>/
```
components/Admin{List,Create,Edit}/, common/
entities/{schema,form,model,drizzle}.ts
services/{client/,server/{drizzleBase,wrappers/,*Service}.ts}
hooks/use{Create,Update,Search,Delete}*.ts
constants/, types/, domain.json
```

### shared (approval required to modify)
```
lib/: crud, errors, drizzle, firebase, storage, mail, jwt, mediaInputSuite, tableSuite, localStorage, redirectToast, cn
config/: admin-global-menu, app-features, maintenance, redirect, user-header, user-bottom-menu
stores/: useAppToastStore, useGlobalLoaderStore, useSiteTheme, useViewportSize
hooks/: useAppToast, useGlobalLoader, useInfiniteScrollQuery, useFieldGuard, useRouteTransitionPending
components/: Form/, Layout/, TextBlocks/, Skeleton/, _shadcn/
registry/: schemaRegistry, serviceRegistry, adminDataMenu
proxies/: middleware handlers
```

## DOMAINS

### core (src/features/core/, no domain.json, manual)
auth, user, wallet, walletHistory, purchaseRequest, setting, mail, adminCommand, domainConfig

### business (src/features/, has domain.json, dc:generate)
sample (relation example), sampleCategory (belongsTo), sampleTag (belongsToMany), _template

## API_ROUTES

### generic (app/api/[domain]/)
GET / -> list
POST / -> create
GET /[id] -> get
PATCH /[id] -> update
DELETE /[id] -> soft delete
POST /search -> search with pagination
POST /upsert -> upsert
POST /bulk/delete-by-ids -> bulk delete
POST /[id]/duplicate -> duplicate
DELETE /[id]/hard-delete -> hard delete
POST /[id]/restore -> restore

### domain-specific
auth/, admin/, wallet/, webhook/, storage/

## CRUD_SERVICE (createCrudService)
operations: create, list, get, update, remove, search, query, upsert, bulkDeleteByIds, bulkDeleteByQuery
drizzle-only: belongsToMany (auto-sync m2m)

extend via: services/server/wrappers/*.ts
use base.query() for: JOINs, transactions, side effects

## CODE_GENERATION

### commands
dc:init -> create domain.json template
dc:generate -- <Domain> -> generate files
dc:generate:all -> generate all with file selection
dc:delete -- <Domain> -> delete domain files

### generated (DO NOT EDIT, will be overwritten)
entities/{schema,form,model,drizzle}.ts
services/client/*.ts
services/server/{drizzleBase,*Service}.ts
hooks/*.ts
components/Admin{List,Create,Edit}/
registry/{schemaRegistry,serviceRegistry,adminDataMenu}.ts

### customizable (safe to edit)
services/server/wrappers/*.ts
components/common/formEntities.ts
constants/*.ts
presenters.ts

## COMPONENTS

use wrappers instead of raw HTML:
- div -> Layout/{Block,Flex,Grid}
- button -> Form/Button
- input -> Form/Input
- p,h2 -> TextBlocks/{Para,SecTitle}
- skeleton -> Skeleton/BaseSkeleton (not shadcn)

ref: src/components/README.md

## ERROR_HANDLING
ServerService: throw DomainError(status, message)
APIRoute: convert to JSON {status, message}
ClientService: normalizeHttpError(error, fallback) -> HttpError
Hook: pass through HttpError
UI: err(error, fallback) for display

## ENTITY_SCHEMA
schema.ts: XxxBaseSchema, XxxCreateSchema, XxxUpdateSchema (server validation)
form.ts: z.infer types only
formEntities.ts (component-level): UI-only validation
drizzle.ts/firestore.ts: DB structure

## NAMING
components: PascalCase or dir/index.tsx
hooks: useCamelCase.ts
services: camelCase.ts
entities: lowercase files, PascalCase types
routes: kebab-case or (group)
constants: UPPER_SNAKE_CASE

## PROHIBITED
- fetch on client-side (use axios)
- direct DB in API routes (use ServerService)
- raw HTML when wrappers exist
- form schemas in entities/schema.ts
- hooks calling ServerService
- skip normalizeHttpError in ClientService
- manual m2m sync when belongsToMany available
- re-implement CRUD when base suffices
- edit generated files without wrappers

## CORE_FILES (approval required)
src/lib/, src/features/core/, src/components/, scripts/domain-config/, src/styles/config.css

## DOCS
!must-read/: architecture, component design, error handling
concepts/: design decisions
how-to/: step-by-step guides
core-specs/: DB differences, service specs
troubleshooting/: common issues
