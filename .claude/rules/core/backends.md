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
> Tier1-owned: forks never edit (gap → /order <direct parent>)

rules: servers→src imports = lib/realtimeRoom/protocol + features/*/room ONLY | src→servers forbidden | room reducer = features/\<domain\>/room/ (pure, lint realtime-room/purity) | economy/authority actions = server dispatch (createRoomClient) ONLY, Postgres stays authoritative | protocol breaking change → bump ROOM_PROTOCOL_VERSION

unconfigured: DB / Firebase env (DATABASE_URL, MY_SERVICE_ACCOUNT_KEY, NEXT_PUBLIC_FIREBASE_*) may all be empty right after pnpm ops setup env, and the app still boots | ref: src/lib/firebase/README.md
- detect: isDatabaseConfigured (@/lib/drizzle) | isFirebaseClientConfigured (@/lib/firebase/client/app) | isFirebaseServerConfigured (@/lib/firebase/server/app) | these detect "not configured" only: configured-but-unreachable still throws (never hide outages)
- contract: access while unconfigured → DatabaseNotConfiguredError / FirebaseNotConfiguredError immediately (no connect wait) | always-mounted paths (proxy, root layout, settingService.getGlobalSetting, createCrudService construction) must not crash while unconfigured → new always-mounted code uses the same guard
firestore_rules: a domain the browser writes to Firestore directly is guarded only by its security rules → ship a rules example with it (firestore.rules.example)
high_frequency_presence: typing / presence (tiny values updated every few seconds, onDisconnect) → Realtime Database, never Firestore (billed per write)
