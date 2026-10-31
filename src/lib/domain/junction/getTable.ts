// src/lib/domain/junction/getTable.ts
// 中間テーブルの Drizzle テーブルを取得するユーティリティ（server-only）。
// 表の一覧は引数で受ける（lib は登録表を import しない。結ぶのは src/wiring/domains.ts）

import "server-only";
import { toPascalCase } from "@/utils/stringCase.mjs";
import type { PgTable } from "drizzle-orm/pg-core";

/** 表の const 名 → 表の一覧（schemaRegistry の形） */
export type JunctionTables = Readonly<Record<string, unknown>>;

/**
 * 中間テーブル名から Drizzle テーブルを取得
 *
 * @param tables - 表の一覧
 * @param tableName - 中間テーブル名（snake_case: sample_to_sample_tag）
 * @returns Drizzle テーブル。見つからない場合は undefined
 *
 * @example
 * const table = getJunctionTable(tables, "sample_to_sample_tag");
 * // SampleToSampleTagTable
 */
export function getJunctionTable(tables: JunctionTables, tableName: string): PgTable | undefined {
  // sample_to_sample_tag -> SampleToSampleTagTable
  const tableConstName = `${toPascalCase(tableName)}Table`;
  return tables[tableConstName] as PgTable | undefined;
}

/**
 * 中間テーブル名から Drizzle テーブルを取得（存在しない場合はエラー）
 *
 * @param tables - 表の一覧
 * @param tableName - 中間テーブル名（snake_case）
 * @returns Drizzle テーブル
 * @throws テーブルが存在しない場合
 */
export function getJunctionTableOrThrow(tables: JunctionTables, tableName: string): PgTable {
  const table = getJunctionTable(tables, tableName);
  if (!table) {
    throw new Error(`Junction table not found: ${tableName}`);
  }
  return table;
}
