// src/lib/dataMigration/index.ts
//
// データ移行の主な入口(@/lib/dataMigration): 管理画面の部品・フック・設定の上書きの型。
// API ルートが使う書き出し・取り込みはサーバーの入口 @/lib/dataMigration/server。
// この入口は "use client" を付けない(client の部品はそれぞれのファイルが付ける)。

export * from "./components";
export * from "./configUtils";
export * from "./hooks";
export type { DataMigrationOverride } from "./config";
