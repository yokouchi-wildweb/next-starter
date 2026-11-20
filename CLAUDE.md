ai_native: always adopt the environment and architecture that make development by agents most efficient | premise: agents write this code, not hands, and they stand on a complete context and a full set of tools that this framework keeps complete → reading the whole codebase and rewriting large parts of it is fast, exact and cheap
- tools over hand work: an agent never does by hand what a tool can do | the same thing has one way to do it and a tool (generator, check, skill) carries it out → run the tool | a repeated hand step with no tool yet → build the tool (keeping the tools complete is part of the work) | a place that does it another way is rewritten to match, not kept
- written or checked over remembered: the next agent knows nothing of today's conversation → what must hold goes into the context (a rule, a card, a README) or a check
domain_driven: the business domain is the unit of design: everything one business concept needs lives together in its domain, in the same shape as every other domain → a spec change stays in one place, and since the feature gate opens and closes domains as a whole, a capability is added, closed or removed as a whole
- the owning domain over a shared place: code goes to the domain whose concept it is | only what belongs to no domain becomes a lib (a mechanism) or a shared component (UI) | a component used by one domain stays in that domain
- passing in over reaching in: a lib never imports a domain (what it needs is passed in) | a domain reaches another domain only through its public hooks and services
- each domain's own part over a central list: features, access and tables are declared per domain | a feature = the unit a project switches on or off, its rule lists the domains it opens
  - a domain has no switch of its own: it is open while any open feature lists it, and when no open feature lists it, its pages, APIs, tables and scheduled jobs are closed together → a new mechanism has each domain hold its own part
debt_free: every implementation decision aims at the form that is most rational and cleanest in the long run, and builds the closest state to it that can be reached now | present work is chosen over future debt
- the root over the patch: no stopgap, workaround or special case that leaves the cause in place | nothing old is kept beside the new to save work (alias, half migration)
- paying now over carrying debt: none of these counts against an option: the amount of code edits (rewriting every caller, renames, moves) | rewriting tests and docs | data migration (rebuilding columns or tables, moving existing rows) | a temporary burden on operations (maintenance time, one-time migration work)
  - this is about choosing an option, not about who runs a step: running one stays with whoever the rules name
use: every rule below follows from these three laws | a question no rule covers → decide by the laws | an open design or refactoring choice → take the option the laws favor | the laws disagree → the earlier law first (ai_native, then domain_driven, then debt_free)
- a written rule wins over a law: a rule that seems to break a law is followed and never ignored, and you file /order (a request to the rule's owner, REPO_LINK) to fix it

## THIS_FILE
> **HEART**: CLAUDE.md and the core files (core/) are the heart of this framework: every session's work starts from them → change a rule only after careful thought: run the authoring ladder in core/design.md first
> - each rule item here (pointers aside) is extracted from the same key in its source (a core file, or a card for an item rule), shortened or restated as fits this file → change the source first, then review the matching CLAUDE.md line in the same commit
> - a design rule needed before any file is opened that no core file or card holds (the layers, placement, docs) has CLAUDE.md as its source
> **WRITING**: writing or fixing CLAUDE.md, a rule file or a card → follow core/design.md (it loads when such a file is opened): the format, the size lines, the window and the usual path
> **ROLE**: CLAUDE.md = the entrance to the architecture contract shared by this base and every downstream repo = the essence of core/ (core/ + Tier1 item cards are the canon of the whole framework). NEVER edit it downstream (gap → /order next-starter) | "fork" here = any repo with a parent, middle tiers included
> - words: Tier1 = the top repo (next-starter) | upstream = the direct parent (a rule that means only the top repo says Tier1) | window = an order to next-starter's inbox for a contract change, filed straight from any repo at any tier (core/design.md authoring)
> **CORE**: core = what Tier1 ships and owns, one meaning everywhere = the paths of CORE_FILES core | a fork never edits it; it changes it only through CHANGE_TYPES or /order <direct parent> (with a temporary permit while it waits)

## DOMAINS_AND_FEATURES (the second law at work: what exists, what opens, what closes)
domain_unit: a domain = the unit of design = src/features/\<domain\>/ (core domains src/features/core/, business src/features/\<domain\>/) | a domain has no switch of its own | what a domain holds and how it is made → DOMAINS
feature_gate (MANDATORY): a feature = the unit a project switches on or off = a rule src/featureGate/rules/\<name\>.ts listing the domains it opens (fork values src/config/featureGate/switches.config.ts) | a domain is open while any open feature lists it, listed by none = base | a closed feature → its own paths 404 | a domain no open feature lists → its tables, generic API and cron close
- dependencies: a feature on a feature → dependsOn (nested URL → dependsOn parent) | code outside a gated domain that uses it → wrap with the gate (requires / gate / required)
- new route / feature → its rule, 1 URL = 1 feature | read the gate only via gate / useGate | unused upstream page → close its feature | pnpm ops features list|set | ref: src/featureGate/README.md, detail → core/proxy.md
district_map: what exists and what each district holds → src/lib/districtMap (list src/registry/district-map.jsonl, generated, never imported from src) | what closes → src/featureGate | the two are the domain-driven base (src_root_bases)

## TOOLS (the context and a full set of tools hold up ai_native)
use: a step a tool covers is never built by hand → run the tool | unsure which tool → scripts/README.md and the descriptions in .claude/skills/
- build: pnpm forge (domains, roles, profiles end to end) | pnpm generate \<target\> (domain, role, registry, routes, cron, extensions, styles)
- check: pnpm check [--gate=ship] | pnpm test [--changed] | pnpm typecheck | pnpm lint = the checks, run only inside the shipping tools (/ship, /flux segments) | reading, inspecting, trial runs that write nothing and generators are work, not checks → core/notices.md checks_in_ship
- workflow: pnpm workflow \<area\> (ownership, rules, notices, worktree, devcheck, repo-json …) | ops: pnpm ops \<area\> (setup env, features, db inspect, firestore inspect) | task: pnpm task \<name\> (every ops task, no ad-hoc)
- running_app: a check that needs the running app → /devcheck (an order's check sheet → /patrol) | what the agent may run = repo.json agent.* policy, never stated here, changed only by /repo-policy
- skills: /ship (checks, notice, commit, push) | /flux (take a parent's changes) | /order /inbox /wen (orders) | /devcheck /patrol (the running app) | /allow /repo-policy (what the agent may run) | the rest → .claude/skills/

## REPO_LINK (one loop links the repos: ship → take in → order → answer → resolves; detail → core/notices.md)
loop: upstream ships with /ship (a notice when downstream must follow) → downstream takes it in with /flux, segment by segment → what is missing goes out as /order \<to\> → the receiver judges and answers with /inbox (/wen checks yours) → the notice that ships it says resolves: and the temporary permit and the provisional rule end
ship (MANDATORY): every commit + push = /ship (checks, notice, commit, push) | which kind and when → .claude/skills/ship/SKILL.md | a fix to a shipped change → delivery
delivery: three ways to forks: a new notice (forks must follow) | editing a shipped notice's body (a description fix; forks that have not taken it in read the last version; forks that took it in and must act → a new notice with fixes:) | a hotfix (human's word only, taken ahead, applied by the fork's hotfixApply) | no index: the list is the git history | → core/notices.md delivery
safe_point: the tag on a pushed tip where the full checks passed (/ship --safe) = the only periodic full check | a plain ship's report proposes --safe when due | prod deploys stop unless at a safe point (a fork: its take-in at the parent's) | never add another periodic full-check mechanism | → core/notices.md safe_point
hotfix: a fix the human calls urgent = /ship hotfix → its notice's hotfix: field makes forks take it before every other segment | only on the human's words, never on your own judgment | /ship checks it (pickCheck) | forks apply it with hotfixApply, which skips what their tree lacks and reports it | → core/notices.md hotfix
notice: an upstream change that needs downstream follow-up ships .notices/\<id\>.md in the same commit (MANDATORY, deleting / moving a file forks may extend too) | a key of CLAUDE.md, a core file or a card renamed / moved / removed → old → new in that notice | → core/notices.md notice
checkpoint (MANDATORY on every notice): `checkpoint: <label>` = a segment boundary the author declares | `checkpoint: -` only when the fork cannot work without the next notice
take_in: take a parent's changes with /flux (recommended, not required: it runs the segment checks, the ownership check and the notice steps together)
relay: a mid tier's /flux judges per segment whether each applied upstream notice needs relaying | its unjudged-relay report ≠ 0 = flux not done | → core/notices.md relay
orders: /order \<to\> files a one-off order into that repo's inbox | code of a parent (an intake point missing, a parent's lib, an upstream bug) → the direct parent, with a temporary permit while it waits
- to: a contract change or gap (CLAUDE.md, a core file, a Tier1 card, the window) → next-starter, straight from any tier | a middle tier's own rule → that repo | inbox place and steps → core/notices.md orders
- contract_gap: while waiting, a provisional rule in your own rules (outside core) ending with `(order: <id>)`
resolves (MANDATORY when shipping an order a downstream repo filed): `resolves: <order id>` in the notice → the fork's temporary permit (expiry → core/ownership.md) and its `(order: <id>)` provisional rules end (/flux asks) | → core/notices.md resolves
fork_bootstrap: /fork-init right after clone | spec: docs/setup/新規プロジェクトの立ち上げ_フォークからデプロイまで.md

## RULES_FILES (.claude/rules/: what each place holds, who writes it, merge | core/\<name\>.md = .claude/rules/core/\<name\>.md, items/… = .claude/rules/items/…)
core/: upstream architecture canon, one file per kind of file being written, path-scoped (loads when Read / Write / Edit touches a matching file, a new file only after its first Write) | only Tier1 writes (fork_ownership) | map and authoring ladder: core/design.md | writing .claude/skills/** → core/skills.md
items/<lib|features|components>/<name>.md: item card (what / use / change / rules / read), paths = the item's folder (+ its config and receptacle places) | components: one card per category folder | each repo writes plain-named cards for its own items, Tier1 cards never edited downstream | → core/design.md cards
- reach: a card loads only when its item's folder (+ config, receptacles) is touched, never where the item is merely used → before using an item elsewhere, read its card | a rule every user of a layer needs stays in core/ and here
service/<business>.md: business overview of a tier that defines a business (domains, relations, flows, terms), always loaded | written by that tier, never edited below (check) | not src/business (= business identity values)
lineage.md: rules a tier passes to its downstream, one section per tier, never edit an ancestor's section (→ /order <its owner>) | ref: lineage.md preamble
shortcuts.md, term-aliases.md: upstream above the `fork entries below` marker, own below | other own rules: in .claude/rules/ outside core/, plain names, never restate core | Tier1's own rule files = core/, items/ and its self files
self_files (CHANGE_TYPES 5): .claude/rules/project.md (overview + tier-only info), .claude/rules/behavior.md (work rules), repo.json (machine values, written only through its command, read only via forkIds.mjs) | → core/design.md self_files

## CHANGE_TYPES (the only five ways to change what a parent owns: the owner declares, the repo below uses)
types: 1 replace = switch \<name\>.ts → \<name\>.default, fork \<name\>.replace (a screen: a plain _components/\<X\>Screen.tsx, no mark; a frame: _layout/\<Layout\>.replace) | 2 overlay = \<target\>.override.ts, declared keys only | 3 add = plain name in a receptacle (extensionPoints.ts) | 4 placement = src/styles/, src/config/ | 5 self = same path, each repo writes its own version (self_files)
- marks = .default / .replace / .override only, the owner's files are plain | upstream ships no \<target\>.override.ts (the config override of src/config/** is type 4, CORE_FILES config) | per path → pnpm workflow ownership who | detail → core/change.md
- 5 self: a merge never takes the parent's version (pnpm workflow ownership check) | port the parent's diff by hand, only what fits this repo | → core/change.md 5 self
upstream_side: a repo makes its own thing changeable below only by declaring it: 1 a \<name\>.default beside a plain 1-line switch | 2 the keys an override may set (overrideOf / overrides) | 3 a receptacle in its extensionPoints.ts | 4 a placement for values (src/styles/core/\<name\>.css ↔ src/styles/\<name\>.css, owner config.ts ↔ src/config/) | adding a receptacle → core/receptacles.md
- 5 self: nothing to declare, the list of self files is closed and only Tier1 extends it | a new repo.json key gets a reader default, a required one ships a notice + migration tool
order: 1. a public means is enough → use it | 2. one of the five types at a declared point → use it | 3. none → /order <direct parent> + temporary permit | never invent another way (no fork-name marks, no keep-own merge settings, no edits outside intake points without a temporary permit)

## STACK
next: 16 (react 19, app router) | pkg: pnpm | db: drizzle (neon/postgresql), firestore | state: zustand, swr | forms: react-hook-form + zod | ui: tailwind 4, radix | auth: firebase-auth + jwt | storage: gcs signed direct upload + server-side image metadata strip (sharp) (lib/storage) | http: axios (client), fetch (server)

## CODE_PLACEMENT (3-tier)
domain: src/features/, all including entities | district = lib / domain (core, business) / frame / proxies: own namespace, config.ts + one src/config override, receptacles | its reader → DOMAINS_AND_FEATURES district_map
library: src/lib/\<name\>/, all except entities | owner per library in src/lib/CATALOG.md (one section per owner repo) | closed lib = read via its exports only | writing a lib → core/lib.md
- new lib (any tier): its line in YOUR CATALOG section only | a parent takes it over through an order → drop your copy and line when it ships
- an ancestor's lib: public entry only, never edit or delete inside it (unused = leave it) | behavior change → /order <direct parent> | an own file → your own lib + re-export | → core/lib.md library
unit: src/components/, hooks/, utils/, small-scale (multi-file OK)
decision: business domain? → features/ | multi-file feature? → lib/ (needs entities → domain) | unit: UI→components/, hook→hooks/, pure→utils/ | page-only: private part of a route's default Screen → app/\<route\>/_screen/ (route creator), fork page-only part or replacement Screen → app/\<route\>/_components/ (see SCREENS)
reuse_check: before creating a utility/feature → confirm no equivalent exists (indexes: src/lib/CATALOG.md, src/features/core/README.md) | before using an upstream item for the first time → Read its card (items/…) and its README | before creating a file in an area not read yet → Read a neighbor or its core file
deps: lib→lib OK | lib→features NG, values and types (lint import-boundaries/lib-no-features, all tiers) | features→features (UI): use the target's hooks | features→features (server): through the target's public services (its services/server entry), no cycles | ref: docs/!must-read/設計思想とアーキテクチャ.md
tool_deps (lint import-boundaries, all tiers error): src→scripts NG, tests too (src-no-scripts; shared → src/lib) | scripts/, features/**/scripts/, codemods, tasks, seed.ts → core/scripts.md

## ARCHITECTURE (8-layer)
layers: 1.Page = app/**/page.tsx (1-line switch) → _screen/\<Name\>Screen.tsx (SSR entry) → _screen/loader.ts | 2.Component (features/*/components) | 3.Hook (features/*/hooks, client only) | 4.ClientService (services/client) | 5.APIRoute (app/api/**) | 6.ServerService (services/server, business logic + DB) | 7.Entity (features/*/entities) | 8.DB (PostgreSQL or Firestore)
boundary: Hook → ClientService → HTTP → APIRoute → ServerService | loader (SSR) → ServerService direct OK | Hook → ServerService NG | Hook/Component → APIRoute or axios/fetch directly NG | DB access only inside ServerService (never in API routes) | UI places (Screen, page.tsx, layout, _components, components, hooks) never value-import services/server or DB (core/screens.md)
- no session APIs in src/app (lint page-authz)
errors: ServerService throws DomainError → APIRoute JSON {message} + status → ClientService normalizeHttpError → Hook → UI err(error, fallback) | ref: docs/!must-read/エラーハンドリング方針.md, src/lib/errors/README.md
client_layer: client HTTP code lives in src/lib/** or services/client/** (axios only there), hooks call it → core/client.md | ref: docs/!must-read/アプリ構築における構成層.md

## DIRECTORY_STRUCTURE
features/\<domain\>/: components/{Admin*/, common/} | entities/{schema,form,model,drizzle}.ts | services/{client/, server/{drizzleBase, wrappers/, \<domain\>Service}} | hooks/ | constants/, types/, presenters.ts, domain.json
shared_src: components (index: src/components/README.md), hooks, utils, lib, config, registry, proxies, featureGate | layout frame parts are not shared_src: they live beside their layout in src/app/\<route\>/_layout/
src_root_bases: src/ directly holds only mechanisms that cut across the set of domains (featureGate, registry, wiring) | what follows them (maintenance, demoMode, cron tasks) never goes there | forks never add one (need → /order <direct parent>; fork mechanisms → lib, business → features) | the domain-driven base (featureGate + districtMap) → DOMAINS_AND_FEATURES
code_generation: domain.json `generate` (default true) = forge / pnpm generate domain rewrites the whole domain, hand logic in wrappers/ + write-once files | a generated file to hand-edit → `"generate": false` | → core/generated.md
stores (zustand): app-wide mechanism → closed lib src/lib/\<name\>/ (state inside, read via its entry; no src/stores) | domain-specific → features/\<domain\>/stores/ | one-frame-only → app/\<route\>/_layout/stores/ | structure and rules → core/client.md
naming: components: PascalCase or dir/index.tsx | hooks: useCamelCase.ts | services: camelCase.ts | entities: lowercase files, PascalCase types | routes: kebab-case or (group) | constants: UPPER_SNAKE_CASE | index.ts: re-export only | no same-name .ts + .tsx in one folder (tsc skips the .tsx, pnpm check rules)
db_identifiers: PostgreSQL names ≤ 63 chars | drizzle's auto FK name gets truncated and can collide → keep table / column names short, or name the FK (`foreignKey({ name: "shortname_fk", … })`) | → core/db.md db_identifiers

## DOMAINS (what a domain is and how it opens → DOMAINS_AND_FEATURES)
core_domains: src/features/core/ = domains Tier1 ships (forks change them only through CHANGE_TYPES, fork_ownership) | business = all a fork or mid tier adds (src/features/\<domain\>/) | a domain Tier1 adds is core (business shape example: src/features/sample) | promotion to core = Tier1's call | hand-written vs generated is not part of the definition
- index: src/features/core/README.md | imports omit core/ (@/features/\<coreDomain\>/* → features/core/)
- more data on an upstream domain's records → a table in your own domain, or /order <direct parent> | never a DB column on an upstream domain's table (core/db.md upstream_tables)
business: src/features/\<domain\>/ with domain.json → pnpm generate domain, or hand-written with the same files (domainEntry.ts etc., scanned alike) | before creating or editing any domain.json → MUST read src/features/README.md | writing domain.json / role / profile → core/domain-definition.md
commands: write domain.json / *.role.json / *.profile.json by hand (no interactive builders) → `pnpm forge` (every generator and check in order, prints the db:push step) | steps and gates → core/domain-definition.md commands
- single steps: pnpm generate domain -- \<Domain\> [--only \<categories\>] | --delete \<Domain\> --confirm \<snake_name\> | `-i` (interactive) never in agent work, CI or notices
schema_registry (MANDATORY): src/registry/schemaRegistry.ts = the only push entry (pnpm db:push), generated whole by pnpm generate registry | new table → pnpm generate registry + a notice with `[user-run] db:push` | unregistered = never created, writes fail silently | → core/db.md
service_registry (MANDATORY): serviceRegistry = the one way to resolve a domain name ↔ service / table / id column (never a per-feature map) | server callers → src/wiring/domainRegistry.ts, a lib takes the registry passed in | → core/api-routes.md lookup
push_roundtrip (MANDATORY when adding/changing an index): after `pnpm db:push` (who runs it = repo.json agent.db_push), `pnpm db:push:check` must report zero statements (a read-only check of the DB, not a code check; the agent may run it)
- never `sql\`${col} DESC\`` (use .desc()) or plain columns mixed with sql expressions in one index (DROP+CREATE on every push = write lock) | push may lock tables → maintenance / low traffic | → core/db.md
setting (core): admin changes it while running = setting, fixed at deploy or structural = config | values that mean nothing apart are one key with parts | keys and sections → items/features/setting.md
- each key has one home per repo: the admin + DB by default, or code when listed in the setting config's codeValues (→ items/features/setting.md code_values) | no other switch
field_types: a fieldType's meaning = only the table src/lib/domain/fields/fieldTypes.mjs | never compare or list fieldType names outside it (lint field-type-guard) | → core/domain-definition.md field_types
domain_config: client = \<domain\>/entities/display.ts domainDisplay, never domain.json (lint client-no-domain-json) | server: one domain = its domain.json + normalizeDomainJsonConfig, all domains = @/wiring/domainConfig | → core/components.md domain_config
config_utils: src/lib/domain/ (extractFields, getRelationsOf and the other *Of functions take a domain copy; client index.ts, server server.ts)
inspect: DB / Firestore investigation → pnpm ops db inspect | pnpm ops firestore inspect (usage: scripts/README.md)

## BACKENDS (DB, Firebase, servers; detail → core/backends.md)
unconfigured: DB / Firebase env may be empty after pnpm ops setup env → always-mounted paths (proxy, root layout, settingService.getGlobalSetting, createCrudService construction) and new ones never crash while unconfigured | configured-but-unreachable still throws (never hide outages) | → core/backends.md
doctrine: new domains default dbEngine "Neon" | Firestore = realtime delivery only, when realtime UX is the essential requirement | no business data in Firestore, no logic in Firebase Functions | hot-path realtime (shared state ~1 write/sec+, 100s+ subscribers) → realtimeRoom | → core/backends.md doctrine
servers: standalone programs outside Next/Vercel live in servers/\<name\>/ (own package.json, not in the pnpm workspace) | src→servers forbidden

## CORE_FILES (ownership: who edits what)
core (= CORE, approval required): CLAUDE.md, core/, src/features/core/ (core domains, core roles), src/styles/core/, src/components/, src/proxy.ts, src/proxies/, src/featureGate/, src/wiring/, upstream routes' _screen / _layout, libs in the Tier1 section of src/lib/CATALOG.md | files the fork added = fork-owned | per path → pnpm workflow ownership who
- full list → core/ownership.md
downstream_owned (upstream never edits after creation): root src/styles/*.css, page.tsx / frame layout.tsx of switched routes, _components/** and \<name\>.replace files of upstream routes (not a generated admin route's hand-owned _components/ = the domain owner's), \<target\>.override.ts
intake: every place a fork may write in parent files = src/lib/forkOwnership/intake.txt (kinds: edit / add / region / marker / append / generated / debt / self) | src/config/** = an intake point too (fork and upstream both edit it, rules: config below)
config: src/config/ = values only (logic → domain utils or lib) | value changes OK | structure changes (add/remove keys, type change, rename) need approval
fork_ownership (check: pnpm workflow ownership check, run by /flux after each segment commit and before its push | fails from the start | exit 2 = unverified, never a pass | ref: src/lib/forkOwnership/README.md):
- base = merge-base with the direct parent | parent-owned (in the base): write only inside intake points, never delete / move / rename (a `_` prefix too) | a file added inside an ancestor's lib, or under src/features/core/, src/featureGate/ or core/ outside a receptacle = violation
- multi-tier: strict only for files in the Tier1 version (a middle tier's files may change below it, except an ancestor's .default and service/) → core/ownership.md fork_ownership
- edit outside the intake: an intake point exists → move there | none (incl. upstream bug / perf / security fixes) → /order <direct parent> + temporary permit in .fork-ownership/\<repo_id\>.permits.txt (≥1 order id; expiry → core/ownership.md) | debt rows of intake.txt → permit with that row's order id
fork_core_edit_compat (while a permit lets a fork edit a parent-owned file): stay compatible with upstream callers: props/args the fork adds = optional with an empty default | never delete parent code the fork does not use | never change a name or an argument shape (→ /order <direct parent>) | why → core/ownership.md

## FORK_EXTENSION (copying a parent's parts)
principle: a fork may build any look and any feature | it does not copy behavior it does not change | new features and calling public services or Factories are not copying | a shared part lacks a behavior you need → /order <direct parent> (your own build meanwhile may carry an instead-of mark) | → core/extensions.md judge
- the copy holds only looks and layout (visual state incl.) → copy OK at any line count | unchanged behavior or a guard comes along, or no means → /order <direct parent> + temporary permit | → core/extensions.md judge

## PROHIBITED (cross-cutting bans; area bans sit with their rule)
- edit generated files: a file with a generated mark at its head, or a JSON / JSONL listed as generated (intake.txt generated rows) → edit its source | → core/generated.md
- unpaginated full-fetch of user-scale data (base.search without limit; the default limit 100 silently drops rows) → page/limit + infinite scroll | list() only for small fixed master data
- business.url (@/business) as runtime origin (it is the official business URL for mail/SEO) → getAppBaseUrl() from @/lib/url | never build an origin from Host / X-Forwarded-Host (host header injection)
- messages to users never through lib/mail send() or a channel directly → messagingService.sendMessage / sendMessageToMany with a messages/\<name\>.ts definition (it records the sends and applies opt-outs) | send() = the mail channel only (lint import-boundaries/mail-send-via-messaging) | ref: src/features/core/messaging/README.md
- stage from NODE_ENV or a direct process.env.APP_ENV read → @/lib/appEnv (lint app-env/single-reader) | env files, production guard → core/scripts.md

## PROXY (Next.js 16 proxy, NOT middleware.ts)
entry: src/proxy.ts | skeleton src/proxies/index.ts + items src/proxies/\<name\>.ts | user = ctx.user() only | chain, items → core/proxy.md
features: features, domains and the gate → DOMAINS_AND_FEATURES feature_gate

## API_ROUTES
required: every API route is one Factory call, authz enforced structurally (the list → core/api-routes.md factories; a cron route.ts = createCronTaskRoute from @/wiring/cronRoute) | before writing a route → read src/lib/routeFactory/README.md | imports, generic access, presets → core/api-routes.md
ownership_routes: user-owned ("self only") → createMeRoute (/api/me/**), scoped by ctx.user, never a client-supplied id | generic /api/[domain] stays admin-only | shared kiosk / store device → pairedDevice (createDeviceRoute, scope from `device.scope`)
- → core/api-routes.md route_access
principal: handlers use ctx.user only (the Factory resolves the DB-synced user once per request) | access = public | authenticated | {roles, roleCategories} (+ allowStatuses), no self-guarded route

## ROLES & PAGE_GUARD
roles: core roles (admin, user, debugger) cannot be deleted or disabled by a fork | added roles = *.role.json → pnpm forge | a fork changes values only in \<json name\>.override.ts | an unused added role → enabled:false | ref: items/features/user.md
page_guard: range policy = guard.ts beside the layout (child narrows only), layout = `await guard()` | ranges: admin/(protected) | (user)/(protected) | debug/ | every page loader = nearest guard.ts createLoader({ access, … }) | never re-implement guards | → core/screens.md range

## SCREENS (page layer that downstream replaces without editing core)
before adding or replacing a page, frame layout, Screen or loader → read src/lib/screens/README.md
route_groups (access comes from each range's guard.ts, never the folder name): (user)/(protected) = login | (user)/(public) | (user)/(auth) = login / signup | (user)/(legal) | (marketing)/ = landing outside the user layout | admin/ | debug/ | ref: src/app/README.md
route: page.tsx = 1-line switch → _screen/\<Name\>Screen.tsx (server, default) + _screen/loader.ts | 1 route = 1 Screen | a fork replaces it by copying to _components/\<X\>Screen.tsx, keeps calling the upstream loader, points page.tsx at it, never edits _screen/ (CHANGE_TYPES, FORK_EXTENSION) | → core/screens.md

## COMPONENTS
placement: multi-domain → src/components/ | layout frame parts → app/\<route\>/_layout/ | single-domain section container → features/\<domain\>/components/\<Name\> | single-domain shared part → features/\<domain\>/components/common/ | ref: src/components/README.md
- page-only: a default Screen's own part (and a route the repo creates itself) → app/\<route\>/_screen/ | a fork's page-only part of an upstream route it replaces → app/\<route\>/_components/
core_ui: core domains ship UI as fine-grained public parts (data / flow = hooks, display = props-only parts) composed into default containers | import only a part's entry, never a file inside (lint) | improve freely, breaking change → notice
- fork changes UI: text / icons / colors → config | compose in the route Screen (_components/) from core parts + hooks, copy a container only as FORK_EXTENSION allows | missing value prop → /order <direct parent>
essentials: structure and text → components/ wrappers (div → Layout/*, button → Form/Button …), raw tags only for decoration or effects with no wrapper | lists = InfiniteScrollList + useInfiniteScrollQuery (growing = cursor mode) | every background request shows loading | ui_layers: page (h1, no hooks) → section container (hooks) → part
- → core/components.md wrappers, async_feedback, ui_layers
admin_bulk_actions: admin list bulk actions = receptacle items \<domain\>/adminBulkActions/\<name\>.tsx, never hand-written bulkActions in a Table → items/lib/tableSuite.md
existing_parts: before building a loading, table, selection, paging, overlay or tabs part → Read core/components.md existing_parts | your own build stays allowed (an instead-of mark is optional)
overlays: src/components/Overlays/ (which one → core/components.md existing_parts, overlay) | never a raw Primitives/Dialog
custom_inputs: own input part → register src/wiring/formInputs/inputs/\<name\>.ts, then formInput: "\<name\>" | ref: src/wiring/formInputs/inputs/README.md
style: color source of truth = CSS | before changing tokens, variants, fonts or theme → read src/styles/README.md | semantic colors, config, class groups → core/style.md | spacing (no space-y / space-x → Layout/Stack gap) → core/components.md wrappers

## CRUD_SERVICE (createCrudService)
before adding or changing CRUD calls, search options or raw SQL → read src/lib/crud/README.md | never re-implement base CRUD | service-side rules (extensions, raw SQL, media columns, system writes) → core/services.md | hook-side rules → core/client.md
audit: auto = createCrudService audit option | manual = auditLogger.record({..., tx}) | context = set by the entry (routeFactory, the task runner, the cron route), no entry → runAsSystem | → core/audit.md

## COUNTING (check BEFORE building any count / tracking feature)
matrix: user × key (login only) → userCounter | content × action (anonymous OK) → interactionTracking | user × day "visited?" (DAU / active days / most active users) → analytics DAU (user_daily_activities), not a userCounter key | userCounter and interactionTracking both keep lifetime + daily counts
NOT_for: game telemetry, scroll / mousemove streams, tens of millions of events per day → separate pipeline, never retrofit these domains | auditLog = compliance record, never reuse it for behavior aggregation | ref: items/features/{userCounter,interactionTracking,analytics}.md

## FEATURES
scope: each line = a rule that applies even when you are not editing that feature | detail in the item's card and README
- users_table: no analytics columns on users → per-concern satellite tables
- user_acquisition: signup attribution, opt-in default disabled | the invite link cookie (pending_invite) is gated by referral alone | → items/features/{userAcquisition,referral}.md
- user_name: every write path to users.name MUST use the shared schemas and withUserNameGuard → items/features/user.md
- user_status_history (MANDATORY): any code that writes users.status → recordStatusTransition → items/features/user.md
- coupon_entry_scope (MANDATORY): every code-accepting entry passes one `scope` const to isUsable and redeem / redeemWithEffect → items/features/coupon.md
- fingerprint: opt-in default OFF, signals are reference evidence, never proof → items/features/{deviceFingerprint,fingerprintChallenge}.md
- storage_metadata (MANDATORY): image purposes default metadata "strip", "keep" only when the original is needed | public docs name strip purposes, never "all images" → items/lib/storage.md
- ops_tasks: all via `pnpm task <name>`, no ad-hoc | tasks → core/scripts.md
- cron_wiring (MANDATORY): 1 task = 1 folder src/app/api/cron/\<name\>/ (task.ts + 1-line route.ts, a fork retimes or turns it off with task.override.ts), no list file | vercel.json crons = `pnpm generate cron` output only | upstream add / remove / retime → notice | → items/lib/cron.md
- budgeted_cron (MANDATORY): sweeps over unbounded-growth tables use runBudgetedBatches + createDeadline (@/lib/cron); read models refresh via createIncrementalRefresh → items/lib/cron.md
- analytics_perf: before adding per-domain caches or snapshot tables → withAnalyticsCache or analytics rollups → items/features/analytics.md
- ai_agent: generic runtime src/lib/ai/, each agent owns its safety boundary → items/lib/{ai,dbAgent}.md

## DOCS
policy: colocation-first, primary docs = README.md next to the code | docs/ has exactly 3 folders: !must-read/ (principles), setup/ (external service setup), journal/ (dated records) | README format → core/readme-format.md
stale_README: full rewrite over partial patch when a README contradicts the code
dated_records (incident narrative / verification log / decision history / "記録して"): docs/journal/\<YYYY-MM-DD\>--\<owner\>--\<slug\>.md (owner rule: docs/journal/README.md) | never .claude/rules/ or CLAUDE.md
memory: auto-memory = personal, unreviewed → handoff of in-progress work ONLY (state / next step / end condition / absolute dates, delete when done) | never durable rules / knowledge / environment facts
durable_info: write it to its repo home at that moment with approval (behavior.md / project.md / colocated README / docs/journal; parent-owned paths in a fork → /order <direct parent>) or drop it | corrections are not saved to memory; offer to record one in behavior.md only when it clearly deserves a rule
