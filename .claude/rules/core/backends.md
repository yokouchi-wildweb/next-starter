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
