# DOWNSTREAM NOTICE id:20261106-003534-room-socket-token-expiry
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-06T00:35:34+09:00
severity: action-required
checkpoint: room-socket-token-expiry
change: realtimeRoom WebSocket now lives only until its room_client token's exp: the room keeps exp in the socket attachment, rejects tokens without exp (401), and on every received message or push closes an expired socket with ROOM_CLOSE_CODES.tokenExpired (4001) without sending to it or applying its action; useRoomState reconnects at once with a fresh token on 4001
why: a removed or invalidated user kept receiving room state and sending client actions over an open socket with no upper bound; the bound is now the client token lifetime (REALTIME_ROOM_CONFIG.clientTokenTtlSeconds, default 60s); the Worker code changed, so forks that run their own room Worker must redeploy it
required_actions:
1. Only if src/config/app/realtime-room.config.ts has `enabled: true` (otherwise nothing to do): run `pnpm test:room` and `pnpm test:realtime-room` (both must pass, including any room the fork registered in servers/room/src/registry.ts).
2. Only if enabled: check `clientTokenTtlSeconds` in src/config/app/realtime-room.config.ts. Every connected client now reconnects once per this period (state is re-sent on connect; event effects sent during the reconnect are not delivered). Keep it at or below 600 (10 minutes) — it is the upper bound for revocation to reach a subscriber.
3. [user-run] Only if enabled: redeploy the Worker together with the app: `pnpm deploy:all` (or `pnpm room:deploy` right before the app deploy). Old Workers keep sockets open past exp until redeployed.
verify: pnpm test:room and pnpm test:realtime-room pass; pnpm typecheck passes; after redeploy, pnpm room:check passes
manual_steps: -
refs: servers/room/src/core/room.ts | servers/room/src/core/socketExpiry.ts | servers/room/src/core/auth.ts | src/lib/realtimeRoom/protocol/constants.ts | src/lib/realtimeRoom/client/useRoomState.ts | servers/room/README.md「認可モデル」 | order 20261105-215645-quest-room-socket-token-expiry
notes: No ROOM_PROTOCOL_VERSION bump: the close code is additive and old clients reconnect on any close. In a quiet room (no push, no action) an expired socket stays open until the next push or action but receives nothing. No alarm is used (the room's single alarm slot belongs to the schedule effect). oripa-do (room "raid") must redeploy its Worker.
