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
