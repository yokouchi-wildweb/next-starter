---
paths:
  - "servers/**"
  - "src/lib/realtimeRoom/**"
  - "src/features/*/room/**"
  - "src/lib/drizzle/**"
  - "src/lib/firebase/**"
---
# backends
> **ROLE**: loaded when writing standalone servers, realtimeRoom or the DB / Firebase backends | holds the BACKENDS rules (unconfigured, doctrine, servers)
> Tier1-owned: forks never edit (gap → /order next-starter)

doctrine: new domains default dbEngine "Neon" | Firestore = realtime delivery channel only, chosen only when realtime UX is the essential requirement | no business data in Firestore, no logic in Firebase Functions (Firebase = auth / delivery; files = GCS via lib/storage, Firebase Storage rules = shipped deny-all) | ref: docs/!must-read/バックエンド構成ドクトリン.md
- the crud Firestore adapter is frozen (no additions) | limits: no `or`, single orderBy, no belongsToMany
- auth ↔ users sync paths = core asset → verify both sides on any change
- hot-path realtime (sustained ~1 write/sec+ shared state, 100s+ subscribers, single-TX threshold semantics) → realtimeRoom, not Firestore
servers: standalone programs outside Next/Vercel live in servers/\<name\>/ (own package.json, not in the pnpm workspace) | current: servers/room/ = realtime room authority (Cloudflare Durable Objects, opt-in default off, fail-closed) | before touching servers/ or enabling room → read servers/room/README.md + src/lib/realtimeRoom/README.md
- rules: servers→src imports = lib/realtimeRoom/protocol + features/*/room ONLY | src→servers forbidden | room reducer = features/\<domain\>/room/ (pure, lint realtime-room/purity) | economy/authority actions = server dispatch (createRoomClient) ONLY, Postgres stays authoritative | protocol breaking change → bump ROOM_PROTOCOL_VERSION

unconfigured: DB / Firebase env (DATABASE_URL, MY_SERVICE_ACCOUNT_KEY, NEXT_PUBLIC_FIREBASE_*) may all be empty right after pnpm ops setup env, and the app still boots | ref: src/lib/firebase/README.md
- detect: isDatabaseConfigured (@/lib/drizzle) | isFirebaseClientConfigured (@/lib/firebase/client/app) | isFirebaseServerConfigured (@/lib/firebase/server/app) | these detect "not configured" only: configured-but-unreachable still throws (never hide outages)
- contract: access while unconfigured → DatabaseNotConfiguredError / FirebaseNotConfiguredError immediately (no connect wait) | always-mounted paths (proxy, root layout, settingService.getGlobalSetting, createCrudService construction) must not crash while unconfigured → new always-mounted code uses the same guard
firestore_rules: a domain the browser writes to Firestore directly is guarded only by its security rules → ship a rules example with it (firestore.rules.example)
high_frequency_presence: typing / presence (tiny values updated every few seconds, onDisconnect) → Realtime Database, never Firestore (billed per write)
