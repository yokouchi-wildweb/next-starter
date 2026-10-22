// src/lib/storage/server/index.ts
// サーバー専用の入口（ポート・保存先・用途の引き当て・旧 URL の解析）。テスト用の fake は ./fake から直接 import する

export * from "./port";
export * from "./stores";
export * from "./purposes";
export * from "./legacy";
