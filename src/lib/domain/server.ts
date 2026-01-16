// src/lib/domain/server.ts
// サーバー専用のドメインユーティリティ（server-only）
// クライアントコンポーネントからはインポートしないでください

// junction: 中間テーブル取得（server-only）
export { getJunctionTable, getJunctionTableOrThrow } from "./junction/getTable";

// service/server: サービス取得・ドメイン一覧
export * from "./service/server";
