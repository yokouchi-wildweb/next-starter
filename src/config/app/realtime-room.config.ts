// src/config/app/realtime-room.config.ts

/**
 * リアルタイムルーム基盤 (servers/room + @/lib/realtimeRoom) の設定
 *
 * ここは「値」のみを置く。ロジックは @/lib/realtimeRoom 側に置くこと。
 *
 * 有効化 (downstream オプトイン):
 *   1. enabled を true にする
 *   2. env に REALTIME_ROOM_URL / REALTIME_ROOM_AUTH_SECRET を設定する
 *   3. pnpm room:init → pnpm room:deploy (詳細: servers/room/README.md)
 *
 * enabled=false または env 未設定の間は全経路 fail-closed:
 *   - useRoomState は status:"disabled" を返す (通信しない)
 *   - /api/realtime-room/token は 503
 *   - createRoomClient は DomainError(503)
 *   - pnpm room:deploy は skip
 */
export const REALTIME_ROOM_CONFIG = {
  /** リアルタイムルーム基盤を有効化するか (既定: 無効) */
  enabled: false,

  /** ブラウザ用 WebSocket 接続トークンの有効期間 (秒)。接続ハンドシェイクにのみ使う短命トークン */
  clientTokenTtlSeconds: 60,

  /** Next サーバー → ルームサーバー呼び出し用トークンの有効期間 (秒) */
  serviceTokenTtlSeconds: 60,

  /** useRoomState の再接続バックオフ (ミリ秒)。この間隔から開始し最大値まで倍々で伸びる */
  reconnectBaseDelayMs: 1_000,
  reconnectMaxDelayMs: 15_000,
} as const;
