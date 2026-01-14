# CLAUDE.md

## WORK_RULES (HIGHEST_PRIORITY)
- work_only_on_instructed_scope: true
- no_preemptive_implementation: true
- planning_and_implementation_separated: true
- await_approval_before_implementation: true
- propose_before_modifying_core_files: true
- language_for_comments_and_docs: japanese
- cross_domain_awareness: before implementing, check if other domains need changes. proactively propose changes in the correct domain rather than placing logic in the wrong domain for convenience
- avoid_piped_commands: run commands without pipes to avoid permission prompts. use file arguments instead (e.g. grep pattern file.txt, not cat file.txt | grep pattern)
- avoid_brace_expansion: never use shell brace expansion {A,B} syntax. permission system evaluates raw string before expansion. use separate paths or multiple commands instead (e.g. mkdir -p dir/A dir/B, not mkdir -p dir/{A,B})
- never_commit_without_explicit_instruction: true. never commit unless explicitly requested
- never_push_db_without_explicit_instruction: true. never run db push/migrate commands (e.g. drizzle-kit push, drizzle-kit migrate). always ask user to run manually
- never_use_enter_plan_mode: true. never use EnterPlanMode tool. plan tasks using TodoWrite instead

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
3. Hook (features/*/hooks) -> state (client only)
4. ClientService (features/*/services/client) -> axios
5. APIRoute (app/api/**) -> HTTP interface
6. ServerService (features/*/services/server) -> business logic + DB
7. Entity (features/*/entities) -> schema, types, drizzle/firestore
8. Database -> PostgreSQL | Firestore
```

client/server boundary:
- Hook/ClientService -> HTTP -> APIRoute -> ServerService (indirect only)
- Page (SSR) -> ServerService (direct call allowed)
- Hook -> ServerService: PROHIBITED (client cannot call server directly)

rules:
- client-side: axios only (no fetch)
- db access: only via ServerService (never in API routes directly)

## DIRECTORY_STRUCTURE

### features/<domain>/
```
components/
  Admin{List,Create,Edit}/  <- generated
  common/                   <- domain-specific shared
entities/{schema,form,model,drizzle}.ts
services/client/, server/{drizzleBase,wrappers/,*Service}.ts
hooks/use{Create,Update,Search,Delete}*.ts
constants/, types/, presenters.ts, domain.json
```

### shared (approval required to modify)
```
lib/: crud, errors, drizzle, firebase, storage, mail, jwt, routeFactory, etc.
components/: Form/, Layout/, TextBlocks/, Skeleton/, _shadcn/
stores/: appToast/, globalLoader/, siteTheme/, viewportSize/, adminLayout/
hooks/: useAppToast, useGlobalLoader, useInfiniteScrollQuery, etc.
config/: admin-global-menu, app-features, maintenance, redirect, etc.
registry/: schemaRegistry, serviceRegistry, adminDataMenu
proxies/: middleware handlers
```

## STORES (zustand)

structure: always use subdirectory
```
stores/<name>/
  index.ts           <- re-export (public interface)
  internalStore.ts   <- zustand store (internal, never use directly)
  useStore.ts        <- base hook
```

hierarchy: internalStore -> useStore -> hooks/useXxx (optional extension)

rules:
- state-only: no business logic (use services/)
- UI side-effects: handle in useStore via useEffect
- internalStore: only accessed from useStore.ts

ref: src/stores/README.md

## DOMAINS

| type | location | domain.json | generation | examples |
|------|----------|-------------|------------|----------|
| core | src/features/core/ | no | manual | auth, user, wallet, setting, mail |
| business | src/features/ | yes | dc:generate | sample, sampleCategory, sampleTag |

### code generation

commands: dc:init, dc:generate -- \<Domain\>, dc:generate:all, dc:delete -- \<Domain\>

generated (DO NOT EDIT): entities/, services/, hooks/, components/Admin*/, registry/
customizable (safe to edit): wrappers/, components/common/formEntities.ts, constants/, presenters.ts

ref: src/features/README.md (domain.json schema)

### entity schema
schema.ts: XxxBaseSchema, XxxCreateSchema, XxxUpdateSchema (server validation)
form.ts: z.infer types only
formEntities.ts: FormSchema, FormValues, DefaultValues (component-level)
drizzle.ts: DB table definition

## API_ROUTES

**MANDATORY: all routes must use routeFactory (createApiRoute / createDomainRoute)**

generic (app/api/[domain]/):
GET|POST / (list|create), GET|PATCH|DELETE /[id] (get|update|soft-delete)
POST /search, /upsert, /bulk/delete-by-ids, /[id]/duplicate, /[id]/restore
DELETE /[id]/hard-delete

domain-specific: auth/, admin/, wallet/, webhook/, storage/

ref: src/lib/routeFactory/README.md

## CRUD_SERVICE (createCrudService)

operations: create, list, get, update, remove, search, query, upsert, bulkDeleteByIds, bulkDeleteByQuery
drizzle-only: belongsToMany (auto-sync m2m)

extension_priority: check base methods -> base.query()/wrappers -> custom service

service file organization:
- xxxService.ts: import only, never add implementations directly
- wrappers/: base CRUD method overrides only
- other subfolders: domain-specific services (non-CRUD)

firestore_limits: no or condition, single orderBy, no belongsToMany

## COMPONENTS

### placement
```
src/components/                      <- app-wide (Admin + User)
AppFrames/User/Elements/             <- user app shared (small)
AppFrames/User/Sections/             <- user app shared (larger)
features/<domain>/components/common/ <- domain-specific only
```

decision: use in other domains? -> src/components/ or AppFrames/
          only this domain? -> features/<domain>/components/common/

### wrappers (use instead of raw HTML)
div -> Layout/{Block,Flex,Grid}, button -> Form/Button, input -> Form/Input
p,h2 -> TextBlocks/{Para,SecTitle}, skeleton -> Skeleton/BaseSkeleton
main -> AppFrames/User/Layout/UserPage (user app routes only)

### page-level controls
AppFrames/User/controls: header/footer/bottomMenu visibility (must be in page.tsx)

### ui_layers (4-tier)
page: SSR, minimal tags (main + h1 + section_container)
section_container: PascalCase/index.tsx, wrap with <section>, call hooks here
unit_item: display only, no hooks
interaction_parts: "use client", minimal hooks if self-contained

rules: call hooks at upper layer, pass handlers via props, import only index.tsx

### domain field renderer
domain.json.fields[].formInput -> DomainFieldRenderer -> Input components
types: textInput, numberInput, textarea, select, multiSelect, radio, checkbox, stepperInput, switchInput, dateInput, timeInput, datetimeInput, emailInput, passwordInput, mediaUploader, hidden

ref: src/components/README.md

## ERROR_HANDLING
ServerService: throw DomainError(status, message)
APIRoute: convert to JSON {status, message}
ClientService: normalizeHttpError(error, fallback) -> HttpError
Hook: pass through HttpError
UI: err(error, fallback) for display

## NAMING
components: PascalCase or dir/index.tsx
hooks: useCamelCase.ts
services: camelCase.ts
entities: lowercase files, PascalCase types
routes: kebab-case or (group)
constants: UPPER_SNAKE_CASE
index.ts: re-export only (no implementation logic)

## PROHIBITED
- fetch on client-side (use axios)
- direct DB in API routes (use ServerService)
- raw HTML when wrappers exist
- form schemas in entities/schema.ts (use formEntities.ts)
- hooks calling ServerService
- skip normalizeHttpError in ClientService
- manual m2m sync when belongsToMany available
- re-implement CRUD when base suffices
- edit generated files without wrappers
- direct API route handlers (use routeFactory)
- direct asset paths (use utils/assets: assetPath, imgPath, videoPath, logoPath)

## CORE_FILES (approval required)
src/lib/, src/features/core/, src/components/, scripts/domain-config/, src/styles/config.css

### src/config/ (conditional)
- value changes: allowed without approval
- structure changes: approval required (adding/removing keys, changing types, renaming)

## TOOLS
playwright-mcp: use for CSS/UI verification, dynamic content, when WebSearch/WebFetch fails

## SCRIPTS
ref: scripts/README.md
claude:test -> Claude API connection check (requires ANTHROPIC_API_KEY)

## DOCS (on-demand reference)
location: docs/
structure: !must-read/, concepts/, how-to/, core-specs/, troubleshooting/
