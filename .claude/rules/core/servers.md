---
paths:
  - "servers/**"
  - "src/lib/realtimeRoom/**"
  - "src/features/*/room/**"
---
# SERVERS
> part of the CLAUDE.md contract (see CORE_RULES): upstream-owned, never edit downstream (gap → /upreq) | FORMAT_RULE applies

rules: servers→src imports = lib/realtimeRoom/protocol + features/*/room ONLY | src→servers forbidden | room reducer = features/\<domain\>/room/ (pure, lint realtime-room/purity) | economy/authority actions = server dispatch (createRoomClient) ONLY, Postgres stays authoritative | protocol breaking change → bump ROOM_PROTOCOL_VERSION
