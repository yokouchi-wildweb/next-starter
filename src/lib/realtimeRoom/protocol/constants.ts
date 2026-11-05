// src/lib/realtimeRoom/protocol/constants.ts
//
// realtimeRoom プロトコルの定数。
// このディレクトリ (protocol/) は Next.js アプリと servers/room (Cloudflare Workers) の
// 両方にバンドルされるため、純粋な型と定数のみを置くこと (Node/Next/DB import 禁止)。

/**
 * アプリ ↔ ルームサーバー間のプロトコルバージョン。
 * メッセージ形状・トークンクレームなど互換性が壊れる変更を入れたらインクリメントする。
 * 不一致はハンドシェイク時に明示エラーになる (スキュー検知)。
 */
export const ROOM_PROTOCOL_VERSION = 1;

/** WebSocket 接続時にクライアントトークンを渡すクエリパラメータ名 */
export const ROOM_TOKEN_QUERY_PARAM = "token";

/** トークンクレームの kind 値 */
export const ROOM_TOKEN_KINDS = {
  /** ブラウザ → Worker の WebSocket 購読/許可済み dispatch 用 (短命) */
  client: "room_client",
  /** Next サーバー → Worker の dispatch/getState 用 (短命) */
  server: "room_server",
  /** Worker → Next API へのコールバック (永続化エスケープハッチ) 用 (短命) */
  callback: "room_callback",
} as const;

/**
 * Worker が WebSocket を閉じるときの終了コード (4000-4999 = アプリ定義の範囲)。
 * tokenExpired: 接続トークンの期限が来た (期限後は状態も操作も通らない)。クライアントは新しいトークンで即座に再接続する
 */
export const ROOM_CLOSE_CODES = {
  tokenExpired: 4001,
} as const;
