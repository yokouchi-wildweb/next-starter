// src/lib/domain/junction/getTable.ts
// 多対多の結びの表(D354: 結びの登録の表)を物理の表の名前で引く(server-only)。名前を組み立てない(表の定義の名前を読む)。
// 表の一覧は引数で受ける(lib は登録表を import しない。結ぶのは src/wiring/domainRegistry.ts)

import "server-only";
import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";

/** 表の const 名 → 表の一覧（schemaRegistry の形） */
export type JunctionTables = Readonly<Record<string, unknown>>;

/**
 * 物理の表の名前から Drizzle テーブルを取得
 *
 * @param tables - 表の一覧
 * @param tableName - 結びの表の物理名（sample_to_sample_tag。データの移しの書き出しのドメイン名 = 結びの登録の表）
 * @returns Drizzle テーブル。見つからない場合は undefined
 */
export function getJunctionTable(tables: JunctionTables, tableName: string): PgTable | undefined {
  for (const value of Object.values(tables)) {
    if (is(value, PgTable) && getTableConfig(value).name === tableName) return value;
  }
  return undefined;
}

/**
 * 物理の表の名前から Drizzle テーブルを取得（存在しない場合はエラー）
 *
 * @throws テーブルが存在しない場合
 */
export function getJunctionTableOrThrow(tables: JunctionTables, tableName: string): PgTable {
  const table = getJunctionTable(tables, tableName);
  if (!table) {
    throw new Error(`Junction table not found: ${tableName}`);
  }
  return table;
}
