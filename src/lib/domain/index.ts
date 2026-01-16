// src/lib/domain/index.ts
// ドメインライブラリのエントリーポイント

// ============================================
// Client/Server 共用（server-only なし）
// ============================================

// types: 型定義
export * from "./types";

// config: ドメイン設定
export * from "./config";

// relations: リレーション情報
export * from "./relations";

// fields: フィールド情報
export * from "./fields";

// junction: 中間テーブルユーティリティ（utils のみ、getTable は server-only）
export {
  resolveJunctionTableName,
  resolveJunctionFieldName,
  getJunctionTableInfo,
  isJunctionTableName,
  parseJunctionTableName,
} from "./junction/utils";

// ============================================
// Server Only
// ============================================
// サーバー専用コードは @/lib/domain/server からインポートしてください
