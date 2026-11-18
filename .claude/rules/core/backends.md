---
paths:
  - "servers/**"
  - "src/lib/realtimeRoom/**"
  - "src/features/*/room/**"
  - "src/lib/drizzle/**"
  - "src/lib/firebase/**"
---
# backends
> **ROLE**: loaded when writing standalone servers, realtimeRoom or the DB / Firebase backends | holds BACKENDS / SERVERS rules
> part of the CLAUDE.md contract (see CORE_RULES): upstream-owned, never edit downstream (gap → /order <upstream>) | FORMAT_RULE applies

rules: servers→src imports = lib/realtimeRoom/protocol + features/*/room ONLY | src→servers forbidden | room reducer = features/\<domain\>/room/ (pure, lint realtime-room/purity) | economy/authority actions = server dispatch (createRoomClient) ONLY, Postgres stays authoritative | protocol breaking change → bump ROOM_PROTOCOL_VERSION

env: DATABASE_URL, MY_SERVICE_ACCOUNT_KEY, NEXT_PUBLIC_FIREBASE_* may all be empty right after pnpm ops setup env
detect: isDatabaseConfigured (@/lib/drizzle) | isFirebaseClientConfigured (@/lib/firebase/client/app) | isFirebaseServerConfigured (@/lib/firebase/server/app) | these detect "not configured" only: configured-but-unreachable still throws (never hide outages)
contract: access while unconfigured → DatabaseNotConfiguredError / FirebaseNotConfiguredError immediately (no connect wait) | always-mounted paths (proxy, root layout, settingService.getGlobalSetting, createCrudService construction) must not crash while unconfigured → new always-mounted code uses the same guard | ref: src/lib/firebase/README.md
