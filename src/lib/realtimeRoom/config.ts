// src/lib/realtimeRoom/config.ts
//
// リアルタイムルーム基盤(servers/room + この lib)の設定(既定 + 上書き)。上書きは src/config/lib/realtimeRoom.config.ts(@lib-config/realtimeRoom)。
// 置き方: src/lib/README.md「設定の届け方」。合成: @/lib/defineConfig
//
// 有効化(downstream のオプトイン):
//   1. 上書きで enabled を true にする
//   2. env に REALTIME_ROOM_URL / REALTIME_ROOM_AUTH_SECRET を設定する
//   3. pnpm ops room init → pnpm ops room deploy(詳細: servers/room/README.md)
//
// enabled=false または env 未設定の間は全経路 fail-closed:
//   - useRoomState は status:"disabled" を返す(通信しない)
//   - /api/realtime-room/token は 503
//   - createRoomClient は DomainError(503)
//   - pnpm ops room deploy は skip

import { defineConfig, type OverrideOf } from "@/lib/defineConfig";
import override from "@lib-config/realtimeRoom";

export type RealtimeRoomConfig = {
  /** リアルタイムルーム基盤を有効化するか(既定: 無効) */
  enabled: boolean;
  /** ブラウザ用 WebSocket 接続トークンの有効期間(秒)。接続ハンドシェイクにのみ使う短命トークン */
  clientTokenTtlSeconds: number;
  /** Next サーバー → ルームサーバー呼び出し用トークンの有効期間(秒) */
  serviceTokenTtlSeconds: number;
  /** useRoomState の再接続バックオフ(ミリ秒)。この間隔から開始し最大値まで倍々で伸びる */
  reconnectBaseDelayMs: number;
  reconnectMaxDelayMs: number;
};

const defaults: RealtimeRoomConfig = {
  enabled: false,
  clientTokenTtlSeconds: 60,
  serviceTokenTtlSeconds: 60,
  reconnectBaseDelayMs: 1_000,
  reconnectMaxDelayMs: 15_000,
};

export const realtimeRoomConfigDef = defineConfig(defaults, { label: "realtimeRoom" });

/** 上書きのファイルの型(`export default { ... } satisfies RealtimeRoomOverride`) */
export type RealtimeRoomOverride<E extends object = Record<never, never>> = OverrideOf<typeof realtimeRoomConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const realtimeRoomConfig: RealtimeRoomConfig = realtimeRoomConfigDef.compose(override);
