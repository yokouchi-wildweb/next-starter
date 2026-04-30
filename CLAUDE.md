# CLAUDE.md

> **FORMAT_RULE**: AI agent optimized. No tables, no verbose prose. Use key:value, inline separators (|, ,), bullet points. Keep additions in this style.

## STACK
next: 16 (react 19, app router) | pkg: pnpm | db: drizzle (neon/postgresql), firestore | state: zustand, swr | forms: react-hook-form + zod | ui: tailwind 4, shadcn, radix | auth: firebase-auth + jwt | storage: firebase-storage | http: axios (client), fetch (server)

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
path_alias: tsconfig paths maps @/features/\<coreDomain\>/* → @/features/core/\<coreDomain\>/*. omit core/ in imports (preferred)

commands: dc:init | dc:generate -- \<Domain\> | dc:generate:all | dc:delete -- \<Domain\> | dc:add -- \<Domain\>
config_utils: src/lib/domain/ | getDomainConfig(domain), extractFields(config), getRelations(domain) | client: index.ts, server: server.ts
new_domain_json: MUST read src/features/README.md before creating or editing any domain.json to verify schema format
ref: src/features/README.md

## SETTING (core domain)
singleton: id="global" | extend: just add Zod fields to setting.extended.ts (no DB migration needed)
ref: src/features/core/setting/README.md

## API_ROUTES
required: routeFactory (createApiRoute / createDomainRoute)
generic: GET|POST / (list|create) | GET|PATCH|DELETE /[id] (get|update|soft-delete) | POST /search, /count, /upsert, /bulk/delete-by-ids, /[id]/duplicate, /[id]/restore | DELETE /[id]/hard-delete
domain-specific: auth/, admin/, wallet/, webhook/, storage/
ref: src/lib/routeFactory/README.md

## CRUD_SERVICE (createCrudService)
operations: create, list, get, update, remove, search, count, query, upsert, duplicate, restore, hardDelete, bulkDeleteByIds, bulkDeleteByQuery, bulkUpsert, bulkUpdate | drizzle-only: belongsToMany, reorder(id,afterId), searchForSorting(auto-init NULL sort_order) | sorting requires: sortOrderColumn option
conditional: duplicate(useDuplicateButton), restore/hardDelete(useSoftDelete), reorder/searchForSorting(sortOrderField)
note: list is a subset of search — use only for simple full-fetch. for relations, filtering, pagination → use search. count returns { total } without fetching records
hooks: each operation auto-generates a corresponding use\<Op\>\<Domain\> hook (conditional ops generate only when enabled)
hook_naming_exceptions: get→use\<Domain\>, list→use\<Domain\>List, remove→useDelete\<Domain\>, count→useCount\<Domain\>
server-only(no hook): query, belongsToMany
hook-only: use\<Domain\>ViewModal(useDetailModal)
relationWhere: search/searchWithDeleted/searchForSorting/count accept `relationWhere?: RelationFilter[]` for filtering by relations (Drizzle only). Two variants: BelongsToManyFilter(targetIds+mode:any|all|none) for M2M | BelongsToFilter(where:WhereExpr) for belongsTo. Discriminated by targetIds vs where. Type: RelationFilter from @/lib/crud/types
extraWhere: search/searchWithDeleted/searchForSorting/count accept `extraWhere?: SQL` (Drizzle only) for conditions beyond WhereExpr DSL (subqueries, EXISTS, JSONB, etc.). Type: ExtraWhereOption from @/lib/crud/drizzle
withRelations: `withRelations?: boolean | number`. true/1 = 1 level, 2+ = recursive nested relation fetch (requires nested config on relation definition, max depth=3). Expands belongsTo(FK→object), belongsToMany(IDs→objects), hasMany(parent→child array). use\<Domain\>/use\<Domain\>List hooks do NOT accept WithOptions — use useSearch\<Domain\> (search hook) which passes WithOptions through params
hasManyLimit: `hasManyLimit?: number` in WithOptions. Per-parent child record limit for hasMany expansion (default: 100). Passed via query param from client→API→service
extension: 1.check base methods → 2.relationWhere for relation filtering → 3.extraWhere for SQL injection → 4.base.query()+wrappers → 5.custom service
files: xxxService.ts(import only) | wrappers/(CRUD override) | \<other\>/(domain-specific)
firestore_limits: no or | single orderBy | no belongsToMany

## AUDIT
tables: audit_logs (append-only) | audit_logs_failed (dead-letter)
columns: target_type, target_id(text), actor_id, actor_type(system|admin|user|api_key|webhook), action, before_value, after_value, context, metadata, reason, retention_days, created_at
action_naming: \<domain\>.\<entity\>.\<verb_past\> | e.g. user.email.changed | ESLint-enforced (eslint-rules/audit-action-naming.mjs)
context: ALS auto-injected by routeFactory (actor_id, actor_type, ip, user_agent, request_id) | wrappers omit actorId param

usage: A(auto)+B(manual), combinable
- A: createCrudService with audit:{ enabled, targetType, actionPrefix, trackedFields, bulkMode, recorder:auditLogger } → CRUD lifecycle auto-recorded
- B: import { auditLogger } from "@/features/core/auditLog" → auditLogger.record({ targetType, targetId, action, before, after, tx }) | tx required for rollback consistency

bulkMode: aggregate(default,1-row) | detail(per-record) | off
strict: default true → throw+rollback | false → dead-letter
trackedFields: omit = denylist-applied all fields | denylist: src/lib/audit/denylist.ts (password/token/secret cross-domain)
retention_days: per-row | default 365 | compliance 730+ | cron auto-prunes
emergency_stop: AUDIT_MODE=disabled → all audit no-op

non_http_context: runAsSystem(fn) | runWithAuditContext(ctx, fn)
ui: \<AuditTimeline targetType targetId /\> | /admin/audit-logs cross-search | registerActionLabels({...}) for i18n
cron: pnpm cron audit-log-prune (0 3 * * *) | pnpm cron audit-log-recover-dead-letter (0 * * * *)
ref: docs/how-to/監査ログ採用ガイド.md

## COMPONENTS
placement: multi-domain→src/components/ or AppFrames/ | single-domain→features/\<domain\>/components/common/ | page-only→app/\<route\>/_components/

wrappers (raw HTML NG): div→Layout/{Block,Flex,Grid,Stack} | main→Layout/Main or UserPage | section→Layout/Section | button→Form/Button | input→Form/Input | p→TextBlocks/Para | h2→TextBlocks/SecTitle | skeleton→Skeleton/BaseSkeleton

overlays (direct _shadcn/dialog or self-built overlay NG — pick from here): modal-confirm→Overlays/Dialog | generic modal→Overlays/Modal | tabbed modal→Overlays/TabbedModal | media+rows detail→Overlays/DetailModal | inline confirm→Overlays/Popover/ConfirmPopover | text/number prompt→Overlays/Popover/PromptPopover | action menu→Overlays/Popover/ActionPopover | multi-select list→Overlays/Popover/ChecklistPopover | help/info bubble→Overlays/Popover/InfoPopover | generic popover→Overlays/Popover | hover hint→Overlays/Tooltip | hover preview card→Overlays/HoverCard | image zoom→Overlays/ImageViewer | loading overlay→Overlays/Loading/ScreenLoader | toast→@/lib/toast (GlobalToast+useToast) | low-level only→Overlays/DialogPrimitives
ref: src/components/Overlays/README.md

UserPage: Main alias, wraps \<main\> with containerType, h1 not included

ui_layers:
- page: SSR entry, minimal tags, no hooks
- section_container: \<section\> wrap, call hooks here
- unit_item: display only, no hooks
- interaction_parts: "use client", self-contained, minimal hooks OK
  rule: call hooks at upper layer, pass handlers via props

page_controls: AppFrames/User/controls/ (header/footer/bottomMenu visibility, use in page.tsx)
FieldRenderer: baseFields, fieldPatches, fieldGroups, inlineGroups | onMediaStateChange(MediaState)
FormInputType: textInput, numberInput, textarea, select, multiSelect, combobox, radio, checkbox, stepperInput, switchInput, dateInput, timeInput, datetimeInput, emailInput, passwordInput, colorInput, mediaUploader, hidden, custom, none
programmatic_value: hidden(in schema, no UI, value submitted) or custom(in schema, own UI) | none = excluded from schema entirely, NOT for programmatic use
async_select: AsyncComboboxInput(single), AsyncMultiSelectInput(multi) — async search+select. User-specific: UserAsyncCombobox/UserAsyncMultiSelect (features/core/user/components/common/) — props: role, where, initialId(s), formatLabel
async_guard: useAsyncAction(src/hooks/) — useRefベースの排他ロックで非同期アクションの二重発火を防止。Dialog/ConfirmPopoverはonConfirmがPromiseを返すと自動でloading管理+ロック
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
- unpaginated full-fetch of user-scale data (ユーザーに紐づくデータをbase.search()等でlimit未指定の全件取得するのは禁止。必ずページネーション(page/limit)を使い、UIは無限スクロール等で段階取得すること。base.searchのデフォルトlimit=100は安全策ではなくデータ欠損の原因になる)
- utility functions in config files (src/config/): config files are values only, place logic in relevant domain utils or lib
- direct businessConfig.url for runtime base URL (decision: use getAppBaseUrl() from @/lib/url). businessConfig.url is "事業者の正式URL" (mail/SEO等). 実行環境のオリジン (決済コールバック・メールリンク等) は getAppBaseUrl() 経由のみ。リクエストヘッダ (Host/X-Forwarded-Host) からの組み立ては Host Header Injection になるため禁止

## CORE_FILES (approval required)
src/lib/, src/features/core/, src/components/, src/proxy.ts, src/proxies/, scripts/domain-config/, src/styles/config.css, src/styles/z-layer.css
src/config/: value changes OK | structure changes (add/remove keys, type change, rename) require approval

## TOOLS
playwright-mcp: available | use only when explicitly instructed by user

## SCRIPTS
ref: scripts/README.md | claude:test: API connection check (requires ANTHROPIC_API_KEY)
db:query "SQL": execute SQL | db:tables: list tables | db:describe \<table\>: show structure | db:count [table]: row counts
fs: Firestore equivalent of db: commands (fs:collections, fs:count, fs:describe, fs:query, fs:delete). run without args for usage

## DOCS
location: docs/ | structure: !must-read/, concepts/, how-to/, core-specs/, troubleshooting/, reference/, self-evaluation/
