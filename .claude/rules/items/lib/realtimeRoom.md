---
paths:
  - "src/lib/realtimeRoom/**"
  - "src/config/lib/realtimeRoom.config.ts"
---
# lib/realtimeRoom
what: the Next-side SDK for the room authority server servers/room: server dispatch (createRoomClient), callback verification (verifyRoomCallback), client subscription (useRoomState), shared protocol | entries @/lib/realtimeRoom (config), /server, /client, /node (the shared protocol)
use: always (opt-in by config `enabled`, default off; fail-closed until config and env are set)
change: placement = src/config/lib/realtimeRoom.config.ts (@lib-config/realtimeRoom)
rules:
using:
- subpath_imports: import features from the subpaths /server, /client, /node (never mix "use client" and server-only code); the root entry gives the config only
- pg_first: settle economy and final results in Postgres first; the room carries only display and coordination state
- client_actions_low_authority: client dispatch is limited to the clientActions allow list (high frequency, low authority)
- callback_route: a room callback route is createApiRoute access "public" that calls verifyRoomCallback first (unsigned = 401)
- persistence_by_app: a callback is fire-and-forget; the app's design owns final persistence
read: dispatch, subscribe, callback → Usage | entries, layout → API | config keys → Extension | room logic place → Related
