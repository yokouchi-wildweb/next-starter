---
paths:
  - "servers/**"
  - "src/lib/realtimeRoom/**"
  - "src/domains/*/room/**"
  - "src/lib/drizzle/**"
  - "src/lib/firebase/**"
  - "backend-selection.json"
---
# backends
> **ROLE**: loaded when writing standalone servers, realtimeRoom, the DB / Firebase backends or the backend selection table | holds the BACKENDS rules (selection, unconfigured, doctrine, servers)
> Tier1-owned: forks never edit (gap → /order next-starter)

doctrine: new domains default dbEngine "Neon" | Firestore = realtime delivery channel only, chosen only when realtime UX is the essential requirement | no business data in Firestore, no logic in Firebase Functions (Firebase = auth / delivery; files = GCS via lib/storage, Firebase Storage rules = shipped deny-all) | ref: docs/!must-read/バックエンド構成ドクトリン.md
- the crud Firestore adapter is frozen (no additions) | limits: no `or`, single orderBy, no belongsToMany
- auth ↔ users sync paths = core asset → verify both sides on any change
- hot-path realtime (sustained ~1 write/sec+ shared state, 100s+ subscribers, single-TX threshold semantics) → realtimeRoom, not Firestore
servers: standalone programs outside Next/Vercel live in servers/\<name\>/ (own package.json, not in the pnpm workspace) | current: servers/room/ = realtime room authority (Cloudflare Durable Objects, opt-in default off, fail-closed) | before touching servers/ or enabling room → read servers/room/README.md + src/lib/realtimeRoom/README.md
- rules: servers→src imports = @/lib/realtimeRoom/node (the shared protocol) + domains/*/room ONLY | src→servers forbidden | room reducer = domains/\<domain\>/room/ (pure, lint realtime-room/purity) | economy/authority actions = server dispatch (createRoomClient) ONLY, Postgres stays authoritative | protocol breaking change → bump ROOM_PROTOCOL_VERSION

selection: the backend selection table = root backend-selection.json (type 5 self) | key = a port's name, value = the name of the implementation every selecting point of that port picks | written by its command, read only by the generator and the checks
- command: pnpm workflow backend-selection fill (fills missing keys from each port's compat, local env files only, idempotent) | set <port> <name> | show | ref: scripts/workflow/backend-selection/README.md
- selecting point: a plugs point (change add) with `select: { port, optional?, words, compat }` in a lib's or an always-open domain's extensionPoints.ts | items = <owner or a lib>/plugs/<point>/<name>.ts with a literal `declaration` + `adapter` (none / fake reserved) | the generator writes <owner>/extensions/<point>.ts re-exporting only the chosen item
  - declaration keys: provides, requires, billing, env (all required) + optional requiresFeatures = the features that must be open while this implementation is selected (items/lib/backends.md requires_features)
- backend_requirements: a domain declares the capabilities its code needs as `export const backendRequirements = ["<port>.<word>", …]` in its own extensionPoints.ts | only open domains count | ref: scripts/structure/extensions/README.md
- accepted fork-binding checks: generate and check stop on a missing key, an unknown name, fake selected, unmet backendRequirements, or a selected implementation's requiresFeatures feature closed, unknown or unreadable | the generator and checks themselves come with the backend kit
- env_guard: at the build and ship phases check extensions stops when a port's compat env is set and maps (unknown → compat default) to another name than the table | the message names both implementations and the fix, never the env value
- env_notice: at the build phase a selected item's env.required names absent from the env give one non-stopping line | names the offline runner strips (OFFLINE_ENV) are not judged
- startup_report: pnpm generate extensions writes one line per selecting point into the startupTasks list src/wiring/startup.ts (no item file) | it reads createBackendStatusTask from @/lib/backends and the owner's <point>BackendStatus from its public entry | one line per port at server start (selected, configured / missing names) | never throws, never refuses to boot
  - the owner's public entry exports <point>BackendStatus = { port, selected, isConfigured } (type BackendStatus), never the sendable adapter | missing → generate and check stop

unconfigured: DB / Firebase env (DATABASE_URL, MY_SERVICE_ACCOUNT_KEY, NEXT_PUBLIC_FIREBASE_*) may all be empty right after pnpm ops setup env, and the app still boots | ref: src/lib/firebase/README.md
- detect: isDatabaseConfigured (@/lib/drizzle) | isFirebaseClientConfigured (@/lib/firebase/client) | isFirebaseServerConfigured (@/lib/firebase/server) | these detect "not configured" only: configured-but-unreachable still throws (never hide outages)
- contract: access while unconfigured → DatabaseNotConfiguredError / FirebaseNotConfiguredError immediately (no connect wait) | always-mounted paths (proxy, root layout, settingService.getGlobalSetting, createCrudService construction) must not crash while unconfigured → new always-mounted code uses the same guard
  - base: every <X>NotConfiguredError (Database, Firebase, Storage, Webhook) extends BackendNotConfiguredError (@/lib/errors: port, implementation?, missing env names, side) | detect any with isBackendNotConfiguredError
  - outbox: a handler that hits an unconfigured base holds its row (attempts unchanged, next attempt pushed back), never quarantines it | → items/domains/outbox.md
  - api: routeFactory answers 500 code backend_not_configured | a port selected none (BackendNoneSelectedError) answers 501 code backend_not_selected | body { message, code } only, no port names | the webhook keeps its 503 webhook_not_configured
firestore_rules: a domain the browser writes to Firestore directly is guarded only by its security rules → ship a rules example with it (firestore.rules.example)
high_frequency_presence: typing / presence (tiny values updated every few seconds, onDisconnect) → Realtime Database, never Firestore (billed per write)
