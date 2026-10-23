# CLAUDE.md
> **FORMAT_RULE** (this file and .claude/rules/): agent-optimized, English only (code comments and READMEs follow behavior.md). One decision per item; a line over ~400 chars → split into sub-bullets. key: value. ` | ` (spaced) separates items, `a|b` (unspaced) or "or" = alternatives. Short headings. No tables, history, precedent or dates
> **ROLE**: CLAUDE.md = architecture contract shared by this base and every downstream project. NEVER edit it downstream (gap → /upreq) | holds the rule + when to read the README; detail lives in the colocated README | MUST stay under 200 lines (Claude Code warns above it, adherence drops) → fold into existing lines or move detail to READMEs, never delete blank lines to fit
> **PER_PROJECT** (downstream edits freely): .claude/rules/project.md = map / architecture delta / decision rules | .claude/rules/behavior.md = work rules | both always-loaded → standing rules only, no change logs / dates / incident stories (→ commit body / docs/journal/) | marker files (.claude/rules/shortcuts.md, term-aliases.md): upstream above the `fork entries below` marker, fork below it

## STACK
next: 16 (react 19, app router) | pkg: pnpm | db: drizzle (neon/postgresql), firestore | state: zustand, swr | forms: react-hook-form + zod | ui: tailwind 4, shadcn, radix | auth: firebase-auth + jwt | storage: gcs signed direct upload (lib/storage) | http: axios (client), fetch (server)

## CORE_FILES (ownership: who edits what)
core (approval required): src/features/core/, src/components/, src/proxy.ts, src/proxies/, scripts/domain-config/, src/styles/*.css (except custom/), src/app/**/_screen/** of upstream routes, servers/room/src/core/, servers/room/src/index.ts, src/lib/ libs in upstream sections of src/lib/CATALOG.md (fork-added libs = fork-owned)
downstream_owned (upstream never edits after creation): src/styles/custom/**, src/config/ui/*.config.ts, page.tsx of switched routes, src/app/**/_components/** of upstream routes, src/registry/screenRoutesRegistry.ts (FORK_SCAN_EXCLUDES / FORK_LEGACY_ROUTES), src/app/api/cron/*/override.ts
config: src/config/ = values only (logic → domain utils or lib) | value changes OK | structure changes (add/remove keys, type change, rename) need approval
fork_core_edit_compat (a fork edits a core path; default = don't, prefer /upreq):
- stay backward compatible with upstream callers: props/args the fork adds = optional with an empty default | never delete core code the fork does not use | signature change = add a new name, keep the old
- why: upstream `_screen/*` Screens stay in the fork's tsc scope even when its page.tsx points to `_components/` → an incompatible core edit fails tsc at the next merge | fix the fork's edit, never the upstream Screen | ref: src/lib/screens/README.md §7

## CODE_PLACEMENT (3-tier)
domain: src/features/, all including entities
library: src/lib/\<name\>/, all except entities | owner per library in src/lib/CATALOG.md (one section per owner repo; format: src/lib/README.md; test: pnpm test:lib-catalog)
- new lib (any tier): add its line to YOUR section only | fork lib proven generic → promote upstream, then drop own copy + line
- lib owned by an ancestor repo: public entry only, never edit internals or delete the dir (unused = leave it), behavior change → /upreq
unit: src/components/, hooks/, utils/, small-scale (multi-file OK)
decision: business domain? → features/ | multi-file feature? → lib/ (needs entities → domain) | unit: UI→components/, hook→hooks/, pure→utils/ | page-only: private part of a route's default Screen → app/\<route\>/_screen/ (route creator), fork page-only part or replacement Screen → app/\<route\>/_components/ (see SCREENS)
reuse_check: before creating a utility/feature → confirm no equivalent exists (indexes: src/lib/CATALOG.md, src/features/core/README.md)
deps: lib→lib OK | lib→features NG | features→features (UI): use the target's hooks | features→features (server): direct OK, no cycles | ref: docs/!must-read/設計思想とアーキテクチャ.md

## ARCHITECTURE (8-layer)
layers: 1.Page = app/**/page.tsx (1-line switch) → _screen/\<Name\>Screen.tsx (SSR entry) → _screen/loader.ts | 2.Component (features/*/components) | 3.Hook (features/*/hooks, client only) | 4.ClientService (services/client) | 5.APIRoute (app/api/**) | 6.ServerService (services/server, business logic + DB) | 7.Entity (features/*/entities) | 8.DB (PostgreSQL or Firestore)
boundary: Hook → ClientService → HTTP → APIRoute → ServerService | Page/loader (SSR) → ServerService direct OK | Hook → ServerService NG | Hook/Component → APIRoute or axios/fetch directly NG | DB access only inside ServerService (never in API routes)
http: client HTTP = axios inside ClientService only, always through normalizeHttpError | exceptions: streaming ClientService (SSE) may use fetch + ReadableStream; realtimeRoom useRoomState may use native WebSocket | server side: fetch OK
lint: client-service-boundary/no-direct-import = UI importing services/client or a barrel's *Client → error in upstream UI, warn downstream → wrap in a hooks/ hook (useInfiniteScrollQuery / useDomainMutation / SWR) | legit exception = reasoned eslint-disable | test: pnpm test:client-service-boundary | ref: docs/!must-read/アプリ構築における構成層.md

## PROHIBITED
scope: cross-cutting bans only | area bans sit with their rule: ARCHITECTURE boundary/http, COMPONENTS wrappers/overlays/infinite_scroll, CRUD_SERVICE hooks/system_write, PROXY, SCREENS
- re-implement what base CRUD already provides | manual m2m when belongsToMany is available
- edit generated files (use wrappers; see DIRECTORY_STRUCTURE code_generation)
- form schemas in entities/schema.ts (→ formEntities.ts next to the form)
- direct asset paths (use utils/assets: assetPath, imgPath, videoPath, logoPath)
- space-y/space-x classes (use Layout/Stack, `space` prop = Tailwind spacing scale)
- unpaginated full-fetch of user-scale data (base.search without limit; the default limit 100 silently drops rows) → page/limit + infinite scroll | list() only for small fixed master data
- businessConfig.url as runtime origin (it is the official business URL for mail/SEO) → getAppBaseUrl() from @/lib/url | never build an origin from Host / X-Forwarded-Host (host header injection)
- lib/mail send() for admin→user messages → messagingService.send / bulkSend (@/features/messaging/services/server), which persists per-recipient audit + message_dispatches | lib/mail direct = system template mail only (password reset, verification, registration) | ref: src/features/core/messaging/README.md

## UNCONFIGURED_BACKENDS (boots with DB / Firebase env empty)
env: DATABASE_URL, MY_SERVICE_ACCOUNT_KEY, NEXT_PUBLIC_FIREBASE_* may all be empty right after env:init
detect: isDatabaseConfigured (@/lib/drizzle) | isFirebaseClientConfigured (@/lib/firebase/client/app) | isFirebaseServerConfigured (@/lib/firebase/server/app) | these detect "not configured" only: configured-but-unreachable still throws (never hide outages)
contract: access while unconfigured → DatabaseNotConfiguredError / FirebaseNotConfiguredError immediately (no connect wait) | always-mounted paths (proxy, root layout, settingService.getGlobalSetting, createCrudService construction) must not crash while unconfigured → new always-mounted code uses the same guard | ref: src/lib/firebase/README.md

## BACKEND_DOCTRINE
- new domains default dbEngine "Neon" | Firestore = realtime delivery channel only, chosen only when realtime UX is the essential requirement | no business data in Firestore, no logic in Firebase Functions (Firebase = auth / delivery | files = GCS via lib/storage, Firebase Storage rules = shipped deny-all)
- crud Firestore adapter FROZEN (no additions) | limits: no `or`, single orderBy, no belongsToMany
- auth↔users sync paths = core asset → verify both sides on any change
- hot-path realtime (sustained ~1 write/sec+ shared state, 100s+ subscribers, single-TX threshold semantics) → realtimeRoom (SERVERS), not Firestore | ref: docs/!must-read/バックエンド構成ドクトリン.md

## SERVERS (standalone programs outside Next/Vercel)
placement: servers/\<name\>/ (own package.json, NOT in the pnpm workspace) | current: servers/room/ = realtime room authority (Cloudflare Durable Objects, opt-in default OFF, fail-closed)
rules: servers→src imports = lib/realtimeRoom/protocol + features/*/room ONLY | src→servers forbidden | room reducer = features/\<domain\>/room/ (pure, lint realtime-room/purity) | economy/authority actions = server dispatch (createRoomClient) ONLY, Postgres stays authoritative | protocol breaking change → bump ROOM_PROTOCOL_VERSION
before touching servers/ or enabling room → MUST read servers/room/README.md + src/lib/realtimeRoom/README.md

## PROXY (Next.js 16 proxy, NOT middleware.ts)
entry: src/proxy.ts | handler chain in src/proxies/index.ts: each ProxyHandler returns Response (intercept) or void (pass) → fallback NextResponse.next() | order matters: maintenanceProxy → demoModeProxy → featureGateProxy → redirectProxy | x-pathname: proxy.ts sets it on request headers → server components read headers().get("x-pathname")
feature_gate (MANDATORY): rules = src/config/app/feature-gate.config.ts (enabled false → pathPatterns 404, tables skipped by pnpm db:push: never created, never dropped) | new route/table of a gated domain → add it to its rule (test: pnpm test:feature-gate) | always-mounted callers check the flag themselves | push only via pnpm db:push | ref: src/proxies/README.md
add: handler = src/proxies/\<name\>.ts + register in index.ts | decorator (side effect such as a cookie on pass-through, skipped when a handler intercepts) = register in proxyResponseDecorators | in a fork, registering edits core index.ts → approval + fork_core_edit_compat (append, keep upstream entries)

## DIRECTORY_STRUCTURE
features/\<domain\>/: components/{Admin*/, common/} | entities/{schema,form,model,drizzle}.ts | services/{client/, server/{drizzleBase, wrappers/, \<domain\>Service}} | hooks/ | constants/, types/, presenters.ts, domain.json
shared_src: components (index: src/components/README.md), hooks, utils, stores, lib, config, registry, proxies
code_generation:
- generated (no edit; overwritten on every dc:generate while its generateFiles category is on): entities/, components/Admin*/, components/common/ generated forms/fields/detail modal, hooks/use*\<Domain\>.ts, services/client/\<domain\>Client.ts, services/server/drizzleBase.ts, constants/field.ts, types/field.ts, presenters.ts, app/admin/(protected)/\<domains\>/**/_screen/
- registry: dc:generate appends missing entries to src/registry/ files and rewrites the domain's serviceRegistry line from apiAccess every run | everything else in src/registry/ (CORE DOMAINS block of schemaRegistry.ts, extension registries) = hand-edited
- write-once (generated when absent, never overwritten): app/admin/(protected)/\<domains\>/**/page.tsx (1-line switch), services/server/\<domain\>Service.ts (compose base + wrappers here)
- hand-owned (never overwritten): files you add under wrappers/, formEntities.ts, any other file you add (other constants/ files, hooks with non-generated names), app/admin/(protected)/\<domains\>/**/_components/
- must hand-edit a generated file → first set its category to false in domain.json generateFiles | ref: scripts/domain-config/README.md

## STORES (zustand)
placement: src/stores/ = app-wide only | domain-specific → features/\<domain\>/stores/ | structure: stores/\<name\>/{index.ts, internalStore.ts, useStore.ts}, internalStore → useStore → hooks/useXxx (optional)
rules: state only (logic in services) | UI side effects in useStore's useEffect | internalStore accessed only from useStore.ts | ref: src/stores/README.md

## DOMAINS
core: src/features/core/, hand-maintained (a domain.json there is config source only, NOT a dc:generate target) | index: src/features/core/README.md | imports omit core/ (@/features/\<coreDomain\>/* → features/core/)
business: src/features/\<domain\>/ with domain.json → dc:generate | before creating or editing any domain.json → MUST read src/features/README.md
commands: pnpm dc:init (create domain.json interactively) | dc:add \<Domain\> (append fields to an existing domain.json) | dc:generate \<Domain\> / dc:generate:all (generate files) | dc:delete \<Domain\> | `--` optional | agents / CI / notices: `--yes` = no prompts, generates per domain.json generateFiles (no [user-run]) | ref: scripts/domain-config/README.md
schema_registry (MANDATORY): src/registry/schemaRegistry.ts = the only push entry (pnpm db:push) | business domains: auto-registered | core domain with a new entities/drizzle.ts → add `export *` to the CORE DOMAINS block by hand + `pnpm test:schema-registry` + ship .notices with `[user-run] db:push` | unregistered = table never created, best-effort writes fail silently
push_roundtrip (MANDATORY when adding/changing an index): user runs `pnpm db:push` → `pnpm db:push:check` must report zero statements (read-only dry run, the agent may run it) | ref: scripts/registry/README.md
- a non-round-trip index = DROP+CREATE on every push = write lock on large tables → never `sql\`${col} DESC\`` (use .desc()), never mix plain columns and sql expressions in one index | push may lock tables → run at maintenance / low traffic
setting (core): singleton id "global" | extend = add Zod fields to setting.extended.ts (no DB migration) | ref: src/features/core/setting/README.md
config_utils: src/lib/domain/ (getDomainConfig, extractFields, getRelations; client index.ts, server server.ts)
inspect: pnpm db:query "SQL" | db:tables | db:describe \<table\> | db:count [table] | fs:* = Firestore equivalents (no args = usage) | claude:test = Anthropic API check | ref: scripts/README.md

## API_ROUTES
required: every route uses one of createDomainRoute / createApiRoute / createMeRoute / createDeviceRoute (each enforces authz structurally) | before writing a route → read src/lib/routeFactory/README.md
generic: /api/[domain]/** exposes the CRUD operations (list: src/app/api/[domain]/) | access = serviceRegistry entry { service, access } (TYPE-REQUIRED; domain.json apiAccess → dc:generate; core domains write it in the registry)
- access rules: public | authenticated | none | {roles, roleCategories}, per-op override | not covered → fail-closed admin only | presets: ADMIN_ONLY, PUBLIC_READ, ADMIN_OR_DEBUGGER, plus the single rule ADMIN_OR_DEBUGGER_RULE for createApiRoute or a per-op override (src/config/app/domain-api-access.config.ts)
custom_route_authz: createApiRoute `access` is TYPE-REQUIRED: "public" | "authenticated" | {roles, roleCategories} | "custom" | "custom" → guard inside the handler via requireAdmin() / requireAuthenticated() (@/features/core/auth/services/server/requireRole) | lint route-authz/require-authz warns on an unguarded "custom"
ownership_routes: user-owned ("self only") → createMeRoute (/api/me/**), scope by the passed `user.userId` server-side, never trust a client-supplied id | generic /api/[domain] cannot enforce ownership → keep it admin-only | shared kiosk / store device → pairedDevice (opt-in): createDeviceRoute / deviceGuard, scope from `device.scope` | ref: src/features/core/pairedDevice/README.md
role checks always use the DB-synced getSessionUser | debug APIs: copy GET /api/debug/ping (ADMIN_OR_DEBUGGER_RULE)

## ROLES & PAGE_GUARD
roles: src/features/core/user/roles/*.role.json (core = `_` prefix) → pnpm role:generate → src/registry/roleRegistry.ts | category = admin or user | debugger role = user category, bypasses maintenance + opens /debug
page_guard: authGuard({allowRoles, allowStatuses, redirectTo, ...}) in layouts (@/features/core/auth/services/server/authorization) | already guarded at layout level (pages need no own guard): admin/(protected) + admin/insane (admin roles → /admin/login) | (user)/(protected) (→ /login) | debug/ (admin category + debugger → /login)
flow: proxy (redirectProxy, cookie JWT) → layout (authGuard) → loader (requireCurrentUser = own DB record) | debug pages go under src/app/debug/, never re-implement guards | lint page-authz (error, every tier): layouts fetch no server data (authorization fns only) | session / guard APIs only in layout, _layout/, loader.ts, shared admin loaders | ref: src/features/core/auth/README.md

## CRUD_SERVICE (createCrudService)
before adding or changing CRUD calls, search options or raw SQL → read src/lib/crud/README.md (hooks: src/lib/crud/hooks/README.md)
operations: create, list, get, update, remove, search, count, query, upsert, duplicate, restore, hardDelete, bulk* (DeleteByIds, DeleteByQuery, Upsert, Update, UpdateByIds) | Drizzle-only: belongsToMany, reorder, searchForSorting, replaceByQuery | conditional on domain flags: duplicate, restore/hardDelete, reorder/searchForSorting
search: list = simple full fetch only → relations / filters / pagination use search | options: relationWhere, extraWhere (SQL), extraOrderBy (SQL[], before orderBy, server-only), searchRank, withRelations (depth ≤ 3), hasManyLimit | wrappers that order search results reuse buildSearchWhere / buildSearchRankOrderBy and close ORDER BY with withIdTiebreak (else ties reorder across pages)
extension: 1.base methods → 2.relationWhere → 3.extraWhere → 4.base.query() + wrappers → 5.custom service | files: \<domain\>Service.ts (import only), wrappers/ (CRUD overrides), \<other\>/ (domain-specific)
hooks: one use\<Op\>\<Domain\> per operation | custom mutation hooks MUST build on useDomainMutation (@/lib/crud/hooks); useSWRMutation PROHIBITED | test: pnpm test:crud-hooks
system_write: systemUpdate / systemBulkUpdateByQuery bypass Zod for allowlisted systemColumns → service layer ONLY, never wire to HTTP routes
raw_sql (MANDATORY, no lint guard): never embed a JS Date in a raw sql`` template (Postgres cannot parse it → 500) → pass .toISOString(), Drizzle operators (eq / gt / between …) take Date as is | a raw SQL write to a requestMemo-enabled table (user, setting) → call base.invalidateRequestMemo() right after
media_columns (MANDATORY): media (storage:// ref) columns are written only through the createCrudService storage binding or storageObjectService.attach | raw SQL, systemUpdate and copying a ref into another table are prohibited (share = copy) | before uploading / reading / deleting files → read src/lib/storage/README.md
hiddenColumns: secrets declared with defineHiddenColumns (business: domain.json hiddenColumns) are nulled in every service return and relation embed | read them only through a dedicated finder (e.g. user findByIdWithSecrets), never return them over HTTP | raw drizzle select / returning bypasses this → full rows via getPublicColumns(<Table>) (lint hidden-columns/no-raw-select = error)

## AUDIT
action_naming: \<domain\>.\<entity\>.\<verb_past\> (e.g. user.email.changed, ESLint-enforced)
usage: auto = createCrudService audit option | manual = auditLogger.record({..., tx}) from @/features/core/auditLog/services/server (server-only) | pass tx for rollback consistency
context: routeFactory injects actor / ip / request id | cron / CLI do NOT → wrap recording in runAsSystem (else "AuditContext is not set")
user_visibility: GET /api/me/audit-logs returns only actions allow-listed in src/registry/userVisibleAuditActionsRegistry.ts (upstream empty = always empty) | covert admin actions stay invisible to the target user
secrets: tracked fields pass the cross-domain denylist (src/lib/audit/denylist.ts) | auditLog = compliance record, never reuse it for behavior aggregation | ref: src/features/core/auditLog/README.md

## COUNTING (check BEFORE building any count / tracking feature)
matrix: user × key (login only) → userCounter | content × action (anonymous OK) → interactionTracking | user × day "visited?" (DAU / active days / most active users) → analytics DAU (user_daily_activities), not a userCounter key | userCounter and interactionTracking both keep lifetime + daily counts (per-user daily = userCounter bumpDaily)
userCounter is server-internal only (no client route) | interactionTracking public ingest is fail-closed via src/registry/interactionTargetRegistry.ts
NOT_for: game telemetry, scroll / mousemove streams, tens of millions of events per day → separate pipeline, never retrofit these domains | ref: src/features/core/{userCounter,interactionTracking,analytics}/README.md

## FEATURES
scope: each line = a rule that applies even when you are not editing that feature | read its README before working in it
- users_table: no analytics columns on users → per-concern satellite tables (aggregation axes = typed columns, long tail = jsonb extras)
- user_acquisition: signup attribution, opt-in default disabled | invite links run on their own pending_invite cookie gated by the referral flag, independent of acquisition | ref: src/features/core/userAcquisition/README.md, src/features/core/referral/README.md
- user_name: every write path to users.name MUST use the shared schemas (user/entities/userName.ts) and withUserNameGuard, never redefine name rules inline | uniqueness = app-layer check, not a DB constraint | ref: src/features/core/user/README.md
- user_status_history (MANDATORY): any code that writes users.status → recordStatusTransition (user/services/server/statusHistory.ts) | ref: src/features/core/user/README.md
- coupon_entry_scope (MANDATORY): every code-accepting entry passes `scope` to isUsable / redeem / redeemWithEffect, same scope const for check and redeem | ref: src/features/core/coupon/README.md
- coupon: self-redeem of attribution coupons is rejected in core, never re-check | reason messages only from coupon/constants/redeemReasonMessages.ts | recipients get CouponAttributionRewardForRecipient (never the redeemer) | admin coupon tabs via buildCouponAdminSectionTabs + registry, never hardcoded
- fingerprint: opt-in default OFF, collection and challenge gated independently | signals are spoofable = reference evidence, never proof | user-facing DTOs never expose view counters or IP | ref: src/features/core/{deviceFingerprint,fingerprintChallenge}/README.md
- ops_tasks: all via `pnpm task <name>`, no ad-hoc | cron_wiring (MANDATORY): 1 task = 1 folder src/app/api/cron/\<name\>/ (task.ts: UTC cron `schedule` + run → domain fn; 1-line route.ts; fork retime/off = override.ts), no list file | vercel.json crons = `pnpm cron:generate` output only (Vercel build fails on mismatch) | upstream add/remove/retime → notice | ref: src/lib/cron/README.md
- budgeted_cron (MANDATORY): sweeps over unbounded-growth tables use runBudgetedBatches + createDeadline (@/lib/cron); read models refresh via createIncrementalRefresh | ref: src/lib/cron/README.md, src/features/core/incrementalRefresh/README.md
- analytics_perf: before adding per-domain caches or snapshot tables → withAnalyticsCache (call invalidateAnalyticsCache after rewriting closed buckets) or analytics rollups | ref: src/features/core/analytics/README.md
- ai_agent: generic runtime src/lib/ai/ (runAgent, SSE helpers, versioned AgentEvent contract: breaking change → bump AGENT_PROTOCOL_VERSION) | each agent owns its safety boundary | db agent is fail-closed without DATABASE_URL_READONLY (no fallback) | ref: src/lib/ai/README.md, src/lib/dbAgent/README.md

## STYLE_OWNERSHIP (upstream = structure, downstream = values)
ownership: see CORE_FILES (src/styles/custom/**, src/config/ui/*.config.ts = downstream) | color source of truth = CSS
semantic_colors: success|info|warning|destructive → `bg-x` / `border-x` = fill | `text-x-foreground` = text on the fill | `text-x-text` = text on a plain background | NEVER `text-x` | scrim `bg-overlay/NN` | no raw white/black (background / foreground / card tokens) | lint style-tokens/no-raw-palette (exception = reasoned eslint-disable)
config: variants / fonts / site theme are set through src/config/ui/*.config.ts define*Config({partial}) | variant and size names are public contract (rename → .notices) | before changing tokens, variants, fonts or theme → read src/styles/README.md

## COMPONENTS
placement: multi-domain → src/components/ or AppFrames/ | single-domain section container → features/\<domain\>/components/\<Name\> | single-domain shared part → features/\<domain\>/components/common/ | default-Screen-only part → app/\<route\>/_screen/ | fork page-only → app/\<route\>/_components/ | ref: src/components/README.md
core_domain_ui_boundary: core domains ship the data layer only (entities, services, API routes, client services, hooks) | never add domain-screen UI under src/features/core/**; give a README recipe instead, even when an upreq asks for UI | existing widgets (AuditTimeline etc.) stay, add no new ones
wrappers (raw HTML NG): div → Layout/{Block,Flex,Grid,Stack} | main → Layout/Main or UserPage | section → Layout/Section | button → Form/Button | input → Form/Input | p → TextBlocks/Para | h2 → TextBlocks/SecTitle | skeleton → Skeleton/BaseSkeleton | img → Media/AppImage (never next/image directly)
- never import _shadcn directly (wrapper table: src/components/_shadcn/README.md; no wrapper → propose one)
text_blocks_inherit: TextBlocks do not inherit like raw tags → Span directly inside a heading = `size="inherit" weight="inherit"` | Para in a centered parent = `align="center"` | ref: src/components/TextBlocks/README.md
overlays (never a raw _shadcn dialog or a self-built overlay; all under Overlays/, ref: src/components/Overlays/README.md):
- modal: confirm → Dialog | generic → Modal | tabs → TabbedModal | media + rows → DetailModal | pick N from a large master → AsyncPickerModal
- inline: confirm / prompt / actions / checklist / info → Popover/{Confirm,Prompt,Action,Checklist,Info}Popover | hover → Tooltip, Tooltip/HelpTip, HoverCard | image zoom → ImageViewer | loading → Loading/ScreenLoader | toast → @/lib/toast
ui_layers (page / section_container / part, defined by role; ref: docs/!must-read/UIレイヤーの概念とコンポーネント分割方法.md):
- page = page.tsx switch + Screen (see SCREENS): no hooks, no state, h1 only here
- section_container = what a Screen places directly: features/\<domain\>/components/\<Name\> (no *Page/*Screen/*Section suffix) | calls hooks, HTTP only via hooks | top-level props = contract | a Screen imports the container, never its inside
- part = everything inside a container, not contract | hooks in a part only when fully self-contained | call hooks at the upper layer, pass handlers via props
- data_seam: first-paint data = loader → container prop `initial<Name>` → hook `fallbackData` + `revalidateOnMount: fallbackData === undefined || <SWR cache has the key>` | background data = hook only
forms: FieldRenderer (ref: src/components/Form/FieldRenderer/README.md) | programmatic value = input type hidden (no UI) or custom (own UI); none = excluded from the schema
async_select: async pickers MUST consume Form/Input/Manual/AsyncOptionSource (never re-implement browse/search paging) | form field → AsyncComboboxInput / AsyncMultiSelectInput (users: UserAsyncCombobox / UserAsyncMultiSelect) | modal opened from an action button → AsyncPickerModal (users: useUserAsyncOptionSource, features/core/user)
async_feedback (MUST): every client background request (mutation / submit / sync) shows loading: button spinner, local ScreenLoader or loading toast | prefer Dialog / ConfirmPopover Promise handling and useAsyncAction (src/hooks, double-fire lock) | exception: fire-and-forget tracking
infinite_scroll: use @/components/Widgets/InfiniteScrollList fed by @/hooks/useInfiniteScrollQuery | never build your own sentinel or an isLoading early return (it blanks the list on load-more)
action_optimistic: an action that changes list items returns the processed IDs → onSuccess calls updateItems / removeItems | revalidate only when the response cannot describe the change | never reset to refresh (it empties the list)
cn_class_groups (MANDATORY): a new `--text-*` token in theme.css → register it in src/lib/cn FLUID_TEXT_SIZES (test: pnpm test:cn)
kiosk / device hooks: non-scrolling one-screen pages and src/hooks device hooks (wake lock, fullscreen, orientation, useMediaQuery) → read src/components/AppFrames/Kiosk/README.md | page_controls: AppFrames/User/controls/ (used in the Screen)

## SCREENS (page layer that downstream replaces without editing core)
before adding or replacing a page, Screen or loader → read src/lib/screens/README.md
route_groups: (user)/(protected) = login required | (user)/(public) = public pages | (user)/(auth) = login / signup flows | (user)/(legal) = legal pages | (marketing)/ = landing pages outside the user layout | admin/ | debug/ | ref: src/app/README.md
route: page.tsx = downstream-owned 1-line switch `export { XScreen as default } from "./_screen/XScreen"` (metadata / dynamic OK) | _screen/\<Name\>Screen.tsx = default Screen, owned by the route creator (downstream never edits/deletes upstream ones) | _screen/ may hold the default Screen's private parts | _components/ = downstream Screens and parts only | 1 route = 1 Screen
screen: server component, named export, no default export, NO "use client", never try/catch | hook-bound bits → a "use client" part in _screen/ or a section container
loader: src/app/\<route\>/_screen/loader.ts, never in features/\<domain\> (shared admin loaders excepted) | `load<Name>Screen(props)` = `import "server-only"` + React cache() keyed by resolved primitives + does redirect / notFound itself + returns an explicit minimal DTO whose types it defines | never imports from _components/ or a Screen
session: under (protected) the loader uses only requireCurrentUser({behavior:"redirect", redirectTo = the group's authGuard literal}) | getSessionUser (nullable) only outside (protected): optional personalization, or (auth) pages that redirect by login / status
contracts (rename = keep the old export + .notices): Screen entry, loader (name / args / DTO / redirects), hooks, section container top-level props | not contract: parts, Screen internals
downstream (default rule): every fork user-facing page uses this structure | unmigrated fork routes MUST be listed with a reason in FORK_LEGACY_ROUTES (the list only shrinks) | replace an upstream Screen = copy it to _components/\<X\>Screen.tsx, keep calling the upstream loader, point page.tsx at it | a route deleted in the fork = re-delete on modify/delete conflict
upstream (MANDATORY): never put logic back in page.tsx | new core route = switch form from the start, UPSTREAM_LEGACY_ROUTES stays empty
test: pnpm test:screens auto-discovers every page under src/app (no registration; `_` dirs skipped) | route map: src/app/route-map.txt = generated authz map (URL → policy source), never hand-edit → pnpm routes:map; drift fails pnpm test:route-map; merge conflict → rerun it | ref: src/lib/screens/README.md
admin_generated: dc:generate admin routes use the same structure with shared loaders in features/core/admin/services/server/loaders/ | ref: src/lib/screens/README.md §12

## ERROR_HANDLING
flow: ServerService throws DomainError → APIRoute JSON {message} + status → ClientService normalizeHttpError → Hook → UI err(error, fallback) | ref: docs/!must-read/エラーハンドリング方針.md, src/lib/errors/README.md

## NAMING
components: PascalCase or dir/index.tsx | hooks: useCamelCase.ts | services: camelCase.ts | entities: lowercase files, PascalCase types | routes: kebab-case or (group) | constants: UPPER_SNAKE_CASE | index.ts: re-export only
db_identifiers: PostgreSQL names ≤ 63 chars | drizzle auto FK name `{table}_{column}_{reftable}_{refcolumn}_fk` gets truncated and can collide → keep table/column names short, or name the FK: `foreignKey({ name: "shortname_fk", columns: [...], foreignColumns: [...] })`

## DOWNSTREAM_NOTICES
notice: an upstream change that needs downstream follow-up ships .notices/\<id\>.md in the same commit (MANDATORY also for deleting / moving a file forks may extend: moved: or the deletion in notes:) | file with /downreq, apply with /flux | ledger: .notices/applied/\<fork-id\>.md | ref: .notices/README.md
checkpoint (MANDATORY on every notice): `checkpoint: <label>` = default (one notice = one point where the fork is consistent) | `checkpoint: -` only when the fork cannot work without the next notice (reason in notes:)
relay: a mid tier's /flux judges per segment by git diff whether each applied upstream notice needs relaying (ledger `relay:none` or a drafted relay notice with covers: ids) | `/downreq relay` = only for legacy unjudged ids | ref: .notices/README.md
fork_bootstrap: /fork-init right after clone | spec: docs/setup/新規プロジェクトの立ち上げ_フォークからデプロイまで.md

## DOCS
policy: colocation-first, primary docs = README.md next to the code | docs/ has exactly 3 folders: !must-read/ (principles), setup/ (external service setup), journal/ (dated records) | topic docs → colocated README
stale_README: full rewrite over partial patch when a README contradicts the code
claude_md_additions: CLAUDE.md is loaded every session → a feature adds its existence + MANDATORY rules + when to read its README (`before X → read <README>`) | one decision per item | API, options, mechanism, caveats → colocated README | prefer a line in an existing section
dated_records (incident narrative / verification log / decision history / "記録して"): docs/journal/\<YYYY-MM-DD\>--\<owner\>--\<slug\>.md (owner rule: docs/journal/README.md) | never .claude/rules/ or CLAUDE.md | a distilled fork-specific rule (1 line) may go to project.md
memory: auto-memory = per-directory, personal, unreviewed → handoff of in-progress work ONLY (state / next step / pointer to drafts / end condition checkable by a file, commit or user decision / absolute dates, delete when done), write it freely | never durable rules / knowledge / environment facts
durable_info: write it to its repo home at that moment with approval (behavior.md / project.md / colocated README / docs/journal; upstream-owned paths in a fork → /upreq) or drop it | corrections are not saved to memory: behavior changes normally come as explicit user instructions to edit behavior.md; offer to record one only when it clearly deserves a rule
