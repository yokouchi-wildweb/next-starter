// src/lib/domain/getJunctionTable.ts
// 中間テーブルの Drizzle テーブルを取得するユーティリティ（server-only）

import "server-only";
import * as schema from "@/registry/schemaRegistry";
import { toPascalCase } from "@/utils/stringCase.mjs";
import type { PgTable } from "drizzle-orm/pg-core";

/**
 * 中間テーブル名から Drizzle テーブルを取得
 *
 * @param tableName - 中間テーブル名（snake_case: sample_to_sample_tag）
 * @returns Drizzle テーブル。見つからない場合は undefined
 *
 * @example
 * const table = getJunctionTable("sample_to_sample_tag");
 * // SampleToSampleTagTable
 */
export function getJunctionTable(tableName: string): PgTable | undefined {
  // sample_to_sample_tag -> SampleToSampleTagTable
  const tableConstName = `${toPascalCase(tableName)}Table`;
  return (schema as Record<string, unknown>)[tableConstName] as PgTable | undefined;
}

/**
 * 中間テーブル名から Drizzle テーブルを取得（存在しない場合はエラー）
 *
 * @param tableName - 中間テーブル名（snake_case）
 * @returns Drizzle テーブル
 * @throws テーブルが存在しない場合
 */
export function getJunctionTableOrThrow(tableName: string): PgTable {
  const table = getJunctionTable(tableName);
  if (!table) {
    throw new Error(`Junction table not found: ${tableName}`);
  }
  return table;
}
