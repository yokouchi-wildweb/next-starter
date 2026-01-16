// src/lib/domain/index.ts
// ドメインライブラリのエントリーポイント

// ============================================
// Client/Server 共用（server-only なし）
// ============================================

// config: ドメイン設定
export * from "./config";

// relations: リレーション情報
export * from "./relations";

// fields: フィールド情報
export * from "./fields";

// junction: 中間テーブルユーティリティ（utils のみ、getTable は server-only）
export {
  type JunctionTableInfo,
  resolveJunctionTableName,
  resolveJunctionFieldName,
  getJunctionTableInfo,
  isJunctionTableName,
  parseJunctionTableName,
} from "./junction/utils";

// ============================================
// Server Only
// ============================================

// junction: 中間テーブル取得（server-only）
export { getJunctionTable, getJunctionTableOrThrow } from "./junction/getTable";

// service/server: サービス取得・ドメイン一覧
export * from "./service/server";
