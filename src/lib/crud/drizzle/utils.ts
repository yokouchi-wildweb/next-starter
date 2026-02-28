// src/lib/crud/drizzle/utils.ts

import { omitUndefined } from "@/utils/object";
import type { CreateCrudServiceOptions, UpsertOptions } from "@/lib/crud/types";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";

type TableWithId = PgTable & { id: AnyPgColumn };

/**
 * Drizzle で insert/upsert する値に UUID や timestamp を補完し、
 * undefined フィールドを取り除いたオブジェクトを返す。
 */
export function applyInsertDefaults<TData extends Record<string, any>>(
  data: TData,
  serviceOptions: CreateCrudServiceOptions<TData>,
) {
  const working = {
    ...data,
  } as TData & { id?: string; createdAt?: Date; updatedAt?: Date };

  if (serviceOptions.idType === "uuid") {
    if (working.id === undefined) {
      working.id = uuidv7();
    }
  } else if (serviceOptions.idType === "db") {
    delete working.id;
  }

  if (serviceOptions.useCreatedAt && working.createdAt === undefined) {
    working.createdAt = new Date();
  }
  if (serviceOptions.useUpdatedAt && working.updatedAt === undefined) {
    working.updatedAt = new Date();
  }

  return omitUndefined(working) as TData;
}

/**
 * drizzle テーブル定義からカラム名 → プロパティ名のマッピングを構築する。
 * 例: { "sample_category_id": "sample_category_id", "created_at": "createdAt" }
 */
export function buildColumnToPropertyMap(table: PgTable): Map<string, string> {
  const mapping = new Map<string, string>();

  for (const [propName, column] of Object.entries(table)) {
    // drizzle のカラムオブジェクトは name プロパティを持つ
    if (column && typeof column === "object" && "name" in column && typeof column.name === "string") {
      mapping.set(column.name, propName);
    }
  }

  return mapping;
}

/**
 * レコードのキー名を drizzle スキーマのプロパティ名に正規化する。
 * snake_case のカラム名を camelCase のプロパティ名に変換する。
 * マッピングに存在しないキーはそのまま保持される。
 *
 * @param table - drizzle テーブル定義
 * @param record - 正規化対象のレコード
 * @returns プロパティ名が正規化されたレコード
 */
export function normalizeRecordKeys<T extends Record<string, unknown>>(
  table: PgTable,
  record: T,
): T {
  const columnToProperty = buildColumnToPropertyMap(table);
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    // カラム名 → プロパティ名に変換、見つからなければそのまま
    const normalizedKey = columnToProperty.get(key) ?? key;
    normalized[normalizedKey] = value;
  }

  return normalized as T;
}

/**
 * テーブル定義上 nullable な array カラムの空配列を null に変換する。
 * notNull な array カラム（例: play_button_type）は変換しない。
 */
export function coerceEmptyArraysToNull<T extends Record<string, any>>(
  table: PgTable,
  data: T,
): T {
  const result: Record<string, any> = { ...data };
  for (const [propName, column] of Object.entries(table)) {
    if (
      column &&
      typeof column === "object" &&
      "columnType" in column &&
      column.columnType === "PgArray" &&
      "notNull" in column &&
      column.notNull === false &&
      propName in result &&
      Array.isArray(result[propName]) &&
      result[propName].length === 0
    ) {
      result[propName] = null;
    }
  }
  return result as T;
}

/**
 * upsert の衝突判定対象カラムを解決する。
 */
export function resolveConflictTarget<TData extends Record<string, any>>(
  table: TableWithId,
  serviceOptions: CreateCrudServiceOptions<TData>,
  upsertOptions?: UpsertOptions<TData>,
) {
  const defaultConflictFields = serviceOptions.defaultUpsertConflictFields as
    | Array<Extract<keyof TData, string>>
    | undefined;
  const conflictFields = upsertOptions?.conflictFields ?? defaultConflictFields;

  if (!conflictFields || conflictFields.length === 0) {
    return table.id;
  }

  const columns = conflictFields.map((field) => {
    const column = (table as any)[field];
    if (!column) {
      throw new Error(`Unknown column "${String(field)}" specified for upsert conflict target.`);
    }
    return column as AnyPgColumn;
  });

  return columns.length === 1 ? columns[0] : columns;
}

/**
 * bulkUpdate の allSame 判定用の値比較。
 * === は参照比較のため Date / jsonb / 配列で同一値でも false になる。
 * 値ベースで比較し、同一値を正しく検出して安全な .set() パスに導く。
 */
export function isBulkValueEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (typeof a === "object" && typeof b === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}
