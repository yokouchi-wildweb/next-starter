# CLAUDE.md
> **FORMAT_RULE** (this file and .claude/rules/): agent-optimized, English only (code comments and READMEs follow behavior.md). One decision per item; a line over ~400 chars → split into sub-bullets. key: value. ` | ` (spaced) separates items, `a|b` (unspaced) or "or" = alternatives. Short headings. No tables, history, precedent or dates
> **ROLE**: CLAUDE.md = architecture contract shared by this base and every downstream project. NEVER edit it downstream (gap → /order <upstream>) | holds the rule + when to read the README; detail lives in the colocated README | MUST stay under 200 lines (Claude Code warns above it, adherence drops) → fold into existing lines or move detail to READMEs, never delete blank lines to fit
> **CORE_RULES**: .claude/rules/core/*.md = path-scoped part of this contract (auto-loaded when a file matching its `paths:` is read) | same ownership as CLAUDE.md
> - holds edit-time detail; design-time rules (needed before any file is opened) stay here | each moved section keeps its essentials + `→ .claude/rules/core/<name>.md` here | creating files in an area without reading a neighbor first → read its core rule file
> - test: pnpm test:core-rules (paths match real files, pointers both ways, CLAUDE.md < 200 lines, every line ≤ 400 chars)
> **PER_PROJECT** (downstream edits freely): .claude/rules/project.md = map / architecture delta / decision rules | .claude/rules/behavior.md = work rules | both always-loaded → standing rules only, no change logs / dates / incident stories (→ commit body / docs/journal/) | marker files (.claude/rules/shortcuts.md, term-aliases.md): upstream above the `fork entries below` marker, fork below it

## STACK
next: 16 (react 19, app router) | pkg: pnpm | db: drizzle (neon/postgresql), firestore | state: zustand, swr | forms: react-hook-form + zod | ui: tailwind 4, shadcn, radix | auth: firebase-auth + jwt | storage: gcs signed direct upload + server-side image metadata strip (sharp) (lib/storage) | http: axios (client), fetch (server)

## CORE_FILES (ownership: who edits what)
core (approval required): CLAUDE.md, .claude/rules/core/, src/features/core/, src/components/, src/proxy.ts, src/proxies/ (dot-named files = fork-owned, extensions/ = generated), scripts/domain-config/, src/styles/_base/**, src/styles/README.md, servers/room/src/core/, servers/room/src/index.ts, src/wiring/ (dot-named files = fork-owned)
- routes and libs: src/app/**/{_screen,_layout}/** of upstream routes (dot-named files beside them = fork-owned) | src/lib/ libs in upstream sections of src/lib/CATALOG.md (fork-added libs = fork-owned)
downstream_owned (upstream never edits after creation): root src/styles/*.css (entry global.css, palette / typography / overrides.css), src/config/ui/*.config.ts, page.tsx / frame layout.tsx of switched routes, _components/** and dot-named files of upstream routes, src/registry fork regions, api/cron/*/override.ts, \<target\>.override.ts
- 1-line switch \<name\>.ts(x) beside \<name\>.default.ts(x) (fork impl \<name\>.\<fork name\>.ts(x)) | upstream ships no override | check: extensions:check | ref: scripts/extensions/README.md
- full list of the places a fork may write in upstream files (intake points) = src/lib/forkOwnership/intake.txt (kinds: edit / region / marker / append / generated / debt) | src/config/** = an intake point too (the fork may edit it; upstream edits it as well, rules: config below)
config: src/config/ = values only (logic → domain utils or lib) | value changes OK | structure changes (add/remove keys, type change, rename) need approval
fork_ownership (check: pnpm ownership:check, run by /flux after each segment commit and before its push | fails from the start | exit 2 = unverified, never a pass | ref: src/lib/forkOwnership/README.md):
- base = merge-base with the direct parent | files the fork added = fork-owned | files in the base = parent-owned: write only inside intake points, never delete / move / rename them (a `_` prefix rename too) | adding a file inside an ancestor's lib = violation
- multi-tier: strict only for files in the Tier1 version (walked from the ledger's upstream:\<sha\> to the version without .notices/applied) | files a middle tier added may be edited / deleted / renamed below it | fork name = fork_id: in .claude/rules/project.md (every repo; ledger, permits, CATALOG heading use it)
- unused upstream page → switch it off (app-features pages / feature-gate) | unused role → enabled:false | replacement → _components/ under a new name, 1-line switch in page.tsx
- edit outside the intake: an intake point exists → move there | none (incl. upstream bug / perf / security fixes) → /order <direct parent> + temporary permit in .fork-ownership/\<fork name\>.permits.txt (≥1 order id; expires when all its orders ship as resolves: or the parent touches the file) | debt rows of intake.txt → permit with that row's order id
fork_core_edit_compat (while a permit lets a fork edit a core path):
- stay backward compatible with upstream callers: props/args the fork adds = optional with an empty default | never delete core code the fork does not use | signature change = add a new name, keep the old
- why: upstream `_screen/*` Screens stay in the fork's tsc scope even when its page.tsx points to `_components/` → an incompatible core edit fails tsc at the next merge | fix the fork's edit, never the upstream Screen | ref: src/lib/screens/README.md §7

## CODE_PLACEMENT (3-tier)
domain: src/features/, all including entities
library: src/lib/\<name\>/, all except entities | owner per library in src/lib/CATALOG.md (one section per owner repo; format: src/lib/README.md; test: pnpm test:lib-catalog)
- new lib (any tier): add its line to YOUR section only | fork lib proven generic → promote upstream, then drop own copy + line
- lib owned by an ancestor repo: public entry only, never edit internals or delete the dir (unused = leave it), behavior change → /order <upstream> | a fork file added inside it fails pnpm ownership:check → put it in your own lib and re-export
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
rules: servers→src imports = lib/realtimeRoom/protocol + features/*/room ONLY | src→servers forbidden | reducer / dispatch / protocol rules → .claude/rules/core/servers.md
before touching servers/ or enabling room → MUST read servers/room/README.md + src/lib/realtimeRoom/README.md

## PROXY (Next.js 16 proxy, NOT middleware.ts)
entry: src/proxy.ts | skeleton src/proxies/index.ts (maintenance → demoMode → featureGate → redirect) + frame of items src/proxies/\<name\>[.\<fork ID\>].ts (pnpm extensions:generate, forks never edit index.ts) | user = ctx.user() only | x-pathname header | chain, items, gate rules → .claude/rules/core/proxy.md
feature_gate (MANDATORY): rules = src/proxies/featureGateRules/\<name\>.ts, one per feature (enabled() false → pathPatterns 404, tables of its features folders skipped by pnpm db:push: never created, never dropped) | ref: src/proxies/README.md
- new route of a gated domain → add it to its rule (tables follow the folder) | always-on entries (cron, cleanup, wiring) close themselves | test: FEATURE_GATE_CHECK=all pnpm test:feature-gate | push only via pnpm db:push

## DIRECTORY_STRUCTURE
features/\<domain\>/: components/{Admin*/, common/} | entities/{schema,form,model,drizzle}.ts | services/{client/, server/{drizzleBase, wrappers/, \<domain\>Service}} | hooks/ | constants/, types/, presenters.ts, domain.json
shared_src: components (index: src/components/README.md), hooks, utils, stores, lib, config, registry, proxies | layout frame parts are not shared_src: they live beside their layout in src/app/\<route\>/_layout/
code_generation: generated files (no edit) / registry / write-once / hand-owned lists → .claude/rules/core/code-generation.md | must hand-edit a generated file → first set its category to false in domain.json generateFiles (else the next dc:generate overwrites it) | ref: scripts/domain-config/README.md
stores (zustand): app-wide → src/stores/ | domain-specific → features/\<domain\>/stores/ | one-frame-only → app/\<route\>/_layout/stores/ | structure: stores/\<name\>/{index.ts, internalStore.ts, useStore.ts} | state only (logic in services), internalStore accessed only from useStore.ts | rest → .claude/rules/core/stores.md

## DOMAINS
core: src/features/core/, hand-maintained (a domain.json there is config source only, NOT a dc:generate target) | index: src/features/core/README.md | imports omit core/ (@/features/\<coreDomain\>/* → features/core/)
business: src/features/\<domain\>/ with domain.json → dc:generate | before creating or editing any domain.json → MUST read src/features/README.md
commands: pnpm dc:init (create domain.json interactively) | dc:add \<Domain\> (append fields to an existing domain.json) | dc:generate \<Domain\> / dc:generate:all (generate files) | dc:delete \<Domain\> | `--` optional | agents / CI / notices: `--yes` = no prompts, generates per domain.json generateFiles (no [user-run]) | ref: scripts/domain-config/README.md
schema_registry (MANDATORY): src/registry/schemaRegistry.ts = the only push entry (pnpm db:push) | business domains: auto-registered | core domain with a new entities/drizzle.ts → add `export *` to the CORE DOMAINS block by hand + `pnpm test:schema-registry` + ship .notices with `[user-run] db:push` | unregistered = table never created, best-effort writes fail silently
service_registry (MANDATORY): serviceRegistry = the one way to resolve a domain name ↔ service / table / id column (never add a per-feature map) | ref: src/lib/domain/README.md
- src/registry/serviceRegistry.ts = generated (pnpm registry:generate, checked at build by registry:check) from each domain's services/server/domainEntry.ts { service, access, table, idColumn } (business: dc:generate writes it; core: hand-write it, lazy `service: () => import(...)`, access INTERNAL_ONLY when not for the generic API, table / idColumn = string literals, null only for Firestore)
- server callers → src/wiring/domains.ts (table → domain: findDomainByTable, domain → table: getDomainTable, sync, no service load) | one table = one key | registry = a list that grows one line per domain, not a downstream extension point
push_roundtrip (MANDATORY when adding/changing an index): user runs `pnpm db:push` → `pnpm db:push:check` must report zero statements (read-only dry run, the agent may run it) | ref: scripts/registry/README.md
- a non-round-trip index = DROP+CREATE on every push = write lock on large tables → never `sql\`${col} DESC\`` (use .desc()), never mix plain columns and sql expressions in one index | push may lock tables → run at maintenance / low traffic
setting (core): singleton id "global" | extend = add Zod fields to setting.extended.ts (no DB migration) | ref: src/features/core/setting/README.md
config_utils: src/lib/domain/ (getDomainConfig, extractFields, getRelations; client index.ts, server server.ts)
inspect: pnpm db:query "SQL" | db:tables | db:describe \<table\> | db:count [table] | fs:* = Firestore equivalents (no args = usage) | claude:test = Anthropic API check | ref: scripts/README.md

## API_ROUTES
required: every route uses one of createDomainRoute / createApiRoute / createMeRoute / createDeviceRoute (each enforces authz structurally), imported from @/wiring/apiRoute (value import of @/lib/routeFactory only in src/wiring/**) | before writing a route → read src/lib/routeFactory/README.md
generic: /api/[domain]/** = CRUD ops, access = the domain's domainEntry.ts { service, access } (TYPE-REQUIRED, not covered → fail-closed admin only; truncateAll / export / import open only when named) | access rules, presets, createApiRoute `access` / allowStatuses → .claude/rules/core/api-routes.md
ownership_routes: user-owned ("self only") → createMeRoute (/api/me/**), scope by the passed `user.userId` server-side, never trust a client-supplied id | generic /api/[domain] cannot enforce ownership → keep it admin-only | shared kiosk / store device → pairedDevice (opt-in): createDeviceRoute / deviceGuard, scope from `device.scope` | ref: src/features/core/pairedDevice/README.md
principal: the Factory resolves the DB-synced user once per request → handlers use ctx.user only | access = public | authenticated | {roles, roleCategories} (+ allowStatuses), no self-guarded route | routes never read the session / requireRole / token-only session / jwt cookie (lint, all tiers) | HTTP exports = Factory calls only (lint route-http-export)

## ROLES & PAGE_GUARD
roles: src/features/core/user/roles/*.role.json (core = `_` prefix) → pnpm role:generate → src/registry/roleRegistry.ts | category = admin or user | debugger role = user category, bypasses maintenance + opens /debug
page_guard: range policy = guard.ts beside the layout (root src/app/guard.ts from @/wiring/pageGuard, child = nearest parent's extend: AND, narrows only) | layout = `await guard()` one line | ranges: admin/(protected) + admin/insane (→ /admin/login) | (user)/(protected) (→ /login) | debug/ | ref: src/lib/pageGuard/README.md
- every page loader = nearest guard.ts createLoader({ access, key?, load }) (access required, principal = ctx.user, no session APIs) | route map src/app/route-map.jsonl verifies the chain
flow: proxy → range guard.ts → loader access | debug pages go under src/app/debug/, never re-implement guards | UI places (Screen, page, layout, _components, components, hooks) never import services/server or DB, no session APIs in src/app (lint page-authz) | details → .claude/rules/core/screens.md

## CRUD_SERVICE (createCrudService)
before adding or changing CRUD calls, search options or raw SQL → read src/lib/crud/README.md (hooks: src/lib/crud/hooks/README.md)
essentials: list = small fixed master only, else search (see PROHIBITED) | custom mutation hooks = useDomainMutation, useSWRMutation PROHIBITED | systemUpdate never wired to HTTP | media (storage://) columns only via storage binding / storageObjectService.attach | hiddenColumns never returned over HTTP
detail (operations, search options, extension order, raw_sql Date / requestMemo, hiddenColumns finders / getPublicColumns) → .claude/rules/core/crud-service.md

## AUDIT
usage: auto = createCrudService audit option | manual = auditLogger.record({..., tx}) | cron / CLI → runAsSystem | action name = \<domain\>.\<entity\>.\<verb_past\> (e.g. user.email.changed) | auditLog = compliance record, never reuse it for behavior aggregation | naming, context, user visibility, denylist → .claude/rules/core/audit.md

## COUNTING (check BEFORE building any count / tracking feature)
matrix: user × key (login only) → userCounter | content × action (anonymous OK) → interactionTracking | user × day "visited?" (DAU / active days / most active users) → analytics DAU (user_daily_activities), not a userCounter key | userCounter and interactionTracking both keep lifetime + daily counts (per-user daily = userCounter bumpDaily)
userCounter is server-internal only (no client route) | interactionTracking public ingest is fail-closed via src/registry/interactionTargetRegistry.ts
NOT_for: game telemetry, scroll / mousemove streams, tens of millions of events per day → separate pipeline, never retrofit these domains | ref: src/features/core/{userCounter,interactionTracking,analytics}/README.md

## FEATURES
scope: each line = a rule that applies even when you are not editing that feature | read its README before working in it
- media_collection: several media per record → a mediaCollection field (dc:generate writes the owned child domain and wires it), never a new mediaUploaderMulti text[] column (existing multi columns keep working) | ref: src/features/README.md, src/lib/crud/README.md
- users_table: no analytics columns on users → per-concern satellite tables (aggregation axes = typed columns, long tail = jsonb extras)
- user_acquisition: signup attribution, opt-in default disabled | invite links run on their own pending_invite cookie gated by the referral flag, independent of acquisition | ref: src/features/core/userAcquisition/README.md, src/features/core/referral/README.md
- user_name: every write path to users.name MUST use the shared schemas (user/entities/userName.ts) and withUserNameGuard, never redefine name rules inline | uniqueness = app-layer check, not a DB constraint | ref: src/features/core/user/README.md
- user_status_history (MANDATORY): any code that writes users.status → recordStatusTransition (user/services/server/statusHistory.ts) | ref: src/features/core/user/README.md
- coupon_entry_scope (MANDATORY): every code-accepting entry passes `scope` to isUsable / redeem / redeemWithEffect, same scope const for check and redeem | ref: src/features/core/coupon/README.md
- coupon: self-redeem of attribution coupons is rejected in core, never re-check | reason messages only from coupon/constants/redeemReasonMessages.ts | recipients get CouponAttributionRewardForRecipient (never the redeemer) | admin coupon tabs via buildCouponAdminSectionTabs + registry, never hardcoded
- fingerprint: opt-in default OFF, collection and challenge gated independently | signals are spoofable = reference evidence, never proof | user-facing DTOs never expose view counters or IP | ref: src/features/core/{deviceFingerprint,fingerprintChallenge}/README.md
- storage_metadata (MANDATORY): image purposes default metadata "strip" (server re-encodes, removes GPS/EXIF/XMP/IPTC/ICC), "keep" only when the original is needed (explicit) | user.avatar is always strip | public docs (privacy policy) name strip purposes, never "all images" | ref: src/lib/storage/README.md「位置情報の約束」
- ops_tasks: all via `pnpm task <name>`, no ad-hoc | cron_wiring (MANDATORY): 1 task = 1 folder src/app/api/cron/\<name\>/ (task.ts: UTC cron `schedule` + run → domain fn; 1-line route.ts; fork retime/off = override.ts), no list file | vercel.json crons = `pnpm cron:generate` output only (Vercel build fails on mismatch) | upstream add/remove/retime → notice | ref: src/lib/cron/README.md
- budgeted_cron (MANDATORY): sweeps over unbounded-growth tables use runBudgetedBatches + createDeadline (@/lib/cron); read models refresh via createIncrementalRefresh | ref: src/lib/cron/README.md, src/features/core/incrementalRefresh/README.md
- analytics_perf: before adding per-domain caches or snapshot tables → withAnalyticsCache (call invalidateAnalyticsCache after rewriting closed buckets) or analytics rollups | ref: src/features/core/analytics/README.md
- ai_agent: generic runtime src/lib/ai/ (runAgent, SSE helpers, versioned AgentEvent contract: breaking change → bump AGENT_PROTOCOL_VERSION) | each agent owns its safety boundary | db agent is fail-closed without DATABASE_URL_READONLY (no fallback) | ref: src/lib/ai/README.md, src/lib/dbAgent/README.md

## STYLE_OWNERSHIP (upstream = structure, downstream = values)
ownership: see CORE_FILES | color source of truth = CSS | config, cn class groups → .claude/rules/core/style.md (loaded with any .tsx) | before changing tokens, variants, fonts or theme → read src/styles/README.md
semantic_colors: success|info|warning|destructive → `bg-x` / `border-x` = fill | `text-x-foreground` = text on the fill | `text-x-text` = text on a plain background | NEVER `text-x` | scrim `bg-overlay/NN` | no raw white/black (background / foreground / card tokens) | lint style-tokens/no-raw-palette (exception = reasoned eslint-disable)

## COMPONENTS
placement: multi-domain → src/components/ | layout frame parts → app/\<route\>/_layout/ (README there; components/AppFrames/ = leftover shared parts, shelf decided later) | ref: src/components/README.md
- single-domain section container → features/\<domain\>/components/\<Name\> | single-domain shared part → features/\<domain\>/components/common/ | default-Screen-only part → app/\<route\>/_screen/ | fork page-only → app/\<route\>/_components/
core_domain_ui_boundary: core domains ship the data layer only (entities, services, API routes, client services, hooks) | never add domain-screen UI under src/features/core/**; give a README recipe instead, even when an order asks for UI | existing widgets (AuditTimeline etc.) stay, add no new ones
essentials: raw HTML NG → components/ wrappers (div → Layout/*, button → Form/Button …) | lists = InfiniteScrollList + useInfiniteScrollQuery (never own sentinel / isLoading early return) | every background request shows loading (prefer Dialog / ConfirmPopover Promise handling, useAsyncAction) | ui_layers: page (h1, no hooks) → section container (calls hooks) → part
overlays (never a raw _shadcn dialog or a self-built overlay; all under Overlays/, ref: src/components/Overlays/README.md):
- modal: confirm → Dialog | generic → Modal | tabs → TabbedModal | media + rows → DetailModal | pick N from a large master → AsyncPickerModal
- inline: confirm / prompt / actions / checklist / info → Popover/{Confirm,Prompt,Action,Checklist,Info}Popover | hover → Tooltip, Tooltip/HelpTip, HoverCard | image zoom → ImageViewer | loading → Loading/ScreenLoader | toast → @/lib/toast
detail (wrapper table, ui_layers, data_seam, forms, async_select, optimistic updates, kiosk) → .claude/rules/core/components.md (loaded with any .tsx)

## SCREENS (page layer that downstream replaces without editing core)
before adding or replacing a page, frame layout, Screen or loader → read src/lib/screens/README.md
route_groups: (user)/(protected) = login required | (user)/(public) = public pages | (user)/(auth) = login / signup flows | (user)/(legal) = legal pages | (marketing)/ = landing pages outside the user layout | admin/ | debug/ | ref: src/app/README.md
route: page.tsx = 1-line switch → _screen/\<Name\>Screen.tsx (server, default Screen) + _screen/loader.ts | 1 route = 1 Screen | fork replaces = copy to _components/\<X\>Screen.tsx, keep calling the upstream loader, point page.tsx at it, never edit upstream _screen/ | src/app/route-map.jsonl generated (pnpm routes:map; 1 JSON per page = the guard chain, every row verified)
detail (Screen / loader / session rules, contracts, downstream / upstream rules, tests, admin_generated) → .claude/rules/core/screens.md

## ERROR_HANDLING
flow: ServerService throws DomainError → APIRoute JSON {message} + status → ClientService normalizeHttpError → Hook → UI err(error, fallback) | ref: docs/!must-read/エラーハンドリング方針.md, src/lib/errors/README.md

## NAMING
components: PascalCase or dir/index.tsx | hooks: useCamelCase.ts | services: camelCase.ts | entities: lowercase files, PascalCase types | routes: kebab-case or (group) | constants: UPPER_SNAKE_CASE | index.ts: re-export only
db_identifiers: PostgreSQL names ≤ 63 chars | drizzle auto FK name `{table}_{column}_{reftable}_{refcolumn}_fk` gets truncated and can collide → keep table/column names short, or name the FK: `foreignKey({ name: "shortname_fk", columns: [...], foreignColumns: [...] })`

## DOWNSTREAM_NOTICES
notice: an upstream change that needs downstream follow-up ships .notices/\<id\>.md in the same commit (MANDATORY also for deleting / moving a file forks may extend: moved: or the deletion in notes:) | ledger: .notices/applied/\<fork name\>.md, each line records upstream:\<sha\> | ref: .notices/README.md
- resolves (MANDATORY when shipping an order a downstream repo filed): `resolves: <order id>` in the notice (info notice if nothing else needs one) | forks' temporary permits on that order expire with it
ship (MANDATORY): every commit + push of this repo goes through /ship (checks, judges whether a notice is needed, writes it, pnpm test:notices, commits, pushes) | /flux = its receiving pair | a fix to something shipped earlier → `fixes: <notice id | commit:sha>` in the fix's notice, never edit the earlier notice (/flux warns forks before the broken point)
checkpoint (MANDATORY on every notice): `checkpoint: <label>` = default (one notice = one point where the fork is consistent) | `checkpoint: -` only when the fork cannot work without the next notice (reason in notes:)
relay: a mid tier's /flux judges per segment by git diff whether each applied upstream notice needs relaying (ledger `relay:none` or a drafted relay notice with covers: ids) | `/flux relay` = only for legacy unjudged ids | ref: .notices/README.md
fork_bootstrap: /fork-init right after clone | spec: docs/setup/新規プロジェクトの立ち上げ_フォークからデプロイまで.md

## DOCS
policy: colocation-first, primary docs = README.md next to the code | docs/ has exactly 3 folders: !must-read/ (principles), setup/ (external service setup), journal/ (dated records) | topic docs → colocated README
stale_README: full rewrite over partial patch when a README contradicts the code
claude_md_additions: CLAUDE.md is loaded every session → a feature adds its existence + MANDATORY rules + when to read its README (`before X → read <README>`) | one decision per item | API, options, mechanism, caveats → colocated README | prefer a line in an existing section | edit-time detail of a section that has a core rule file → that file
dated_records (incident narrative / verification log / decision history / "記録して"): docs/journal/\<YYYY-MM-DD\>--\<owner\>--\<slug\>.md (owner rule: docs/journal/README.md) | never .claude/rules/ or CLAUDE.md | a distilled fork-specific rule (1 line) may go to project.md
memory: auto-memory = per-directory, personal, unreviewed → handoff of in-progress work ONLY (state / next step / pointer to drafts / end condition checkable by a file, commit or user decision / absolute dates, delete when done), write it freely | never durable rules / knowledge / environment facts
durable_info: write it to its repo home at that moment with approval (behavior.md / project.md / colocated README / docs/journal; upstream-owned paths in a fork → /order <upstream>) or drop it | corrections are not saved to memory: behavior changes normally come as explicit user instructions to edit behavior.md; offer to record one only when it clearly deserves a rule
