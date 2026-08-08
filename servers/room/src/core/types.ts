// servers/room/src/core/types.ts
//
// Worker ランタイムの環境バインディング型。

export type Env = {
  /** RoomDurableObject の namespace バインディング (wrangler.toml) */
  ROOM: DurableObjectNamespace;
  /** Next 側と共有する HS256 署名鍵 (wrangler secret put で登録) */
  REALTIME_ROOM_AUTH_SECRET: string;
  /** callback effect の宛先 (アプリの正式オリジン)。未設定なら callback は無効 */
  APP_BASE_URL?: string;
};
