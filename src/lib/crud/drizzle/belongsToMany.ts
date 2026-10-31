// src/lib/crud/drizzle/belongsToMany.ts

import { db } from "@/lib/drizzle";
import { and, eq, getTableName, inArray, isNull, sql } from "drizzle-orm";
import { getTableConfig, type AnyPgColumn, type PgTable } from "drizzle-orm/pg-core";
import type { BulkRelationResult } from "../types";
import type { BelongsToManyRelationConfig } from "./types";

const hasOwn = Object.prototype.hasOwnProperty;

type RelationValueMap = Map<string, unknown[]>;

export function separateBelongsToManyInput<
  TData extends Record<string, any>,
  TInput extends Partial<TData> = TData
>(
  data: TInput,
  relations: Array<BelongsToManyRelationConfig<TData>>,
) {
  if (!relations.length) {
    return {
      sanitizedData: data,
      relationValues: new Map<string, unknown[]>(),
    };
  }

  const sanitizedData: Record<string, any> = { ...data };
  const relationValues: RelationValueMap = new Map();

  relations.forEach((relation) => {
    if (hasOwn.call(sanitizedData, relation.fieldName)) {
      const value = sanitizedData[relation.fieldName];
      relationValues.set(relation.fieldName, Array.isArray(value) ? value : []);
      delete sanitizedData[relation.fieldName];
    }
  });

  return {
    sanitizedData: sanitizedData as TInput,
    relationValues,
  };
}

export async function syncBelongsToManyRelations(
  executor: Pick<typeof db, "insert" | "delete">,
  relations: Array<BelongsToManyRelationConfig<any>>,
  recordId: string | number,
  relationValues: RelationValueMap,
) {
  if (!relations.length || !relationValues.size) return;

  for (const relation of relations) {
    if (!relationValues.has(relation.fieldName)) continue;
    const values = relationValues.get(relation.fieldName) ?? [];

    await executor.delete(relation.throughTable).where(eq(relation.sourceColumn, recordId));
    if (!values.length) continue;

    await executor.insert(relation.throughTable).values(
      values.map((targetId) => ({
        [relation.sourceProperty]: recordId,
        [relation.targetProperty]: targetId,
      })),
    );
  }
}

/**
 * 複数レコードのbelongsToManyリレーションを一括同期する。
 * リレーションごとに DELETE 1回 + INSERT 1回 = 計2クエリで完了。
 */
export async function bulkSyncBelongsToManyRelations(
  executor: Pick<typeof db, "insert" | "delete">,
  relations: Array<BelongsToManyRelationConfig<any>>,
  recordIds: Array<string | number>,
  relationValues: RelationValueMap,
) {
  if (!relations.length || !relationValues.size || !recordIds.length) return;

  for (const relation of relations) {
    if (!relationValues.has(relation.fieldName)) continue;
    const values = relationValues.get(relation.fieldName) ?? [];

    // 全対象レコードの既存リレーションを1クエリで削除
    await executor.delete(relation.throughTable).where(inArray(relation.sourceColumn, recordIds));
    if (!values.length) continue;

    // 全対象レコード × 全リレーション値を1クエリで挿入
    const rows = recordIds.flatMap((recordId) =>
      values.map((targetId) => ({
        [relation.sourceProperty]: recordId,
        [relation.targetProperty]: targetId,
      })),
    );
    await executor.insert(relation.throughTable).values(rows);
  }
}

/** bulkAddRelation / bulkRemoveRelation の 1 回あたりの上限（超えたら 400。呼び手が分割して送る） */
export const BULK_RELATION_MAX_IDS = 1000;
export const BULK_RELATION_MAX_TARGET_IDS = 50;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 列の型に合わない値は DB に渡さない（uuid 列に不正な文字列を渡すと 22P02 で 500 になる） */
function isValueForColumn(column: AnyPgColumn, value: string): boolean {
  const sqlType = column.getSQLType();
  if (sqlType === "uuid") return UUID_PATTERN.test(value);
  if (/^(integer|bigint|smallint|serial|bigserial)/.test(sqlType)) return /^\d+$/.test(value);
  return true;
}

/**
 * 関連先の表と主キー列を、中間テーブルの外部キーから引く（belongsToManyRelations の宣言は表を持たないため）。
 * 外部キーが無いと存在確認ができないので、呼び出しを止める。
 */
function resolveRelationTarget(relation: BelongsToManyRelationConfig<any>) {
  const { foreignKeys } = getTableConfig(relation.throughTable);
  for (const foreignKey of foreignKeys) {
    const { columns, foreignColumns, foreignTable } = foreignKey.reference();
    if (columns.length === 1 && columns[0].name === relation.targetColumn.name) {
      return { targetTable: foreignTable, targetIdColumn: foreignColumns[0] };
    }
  }
  throw new Error(
    `bulk relation: "${relation.fieldName}" needs a foreign key from ${getTableName(relation.throughTable)}.${relation.targetColumn.name}.`,
  );
}

async function selectExistingIds(
  executor: Pick<typeof db, "select">,
  table: PgTable,
  idColumn: AnyPgColumn,
  ids: string[],
  excludeDeleted: boolean,
): Promise<Set<string>> {
  const candidates = ids.filter((id) => isValueForColumn(idColumn, id));
  if (!candidates.length) return new Set();
  const deletedAt = (table as unknown as { deletedAt?: AnyPgColumn }).deletedAt;
  const rows = await executor
    .select({ id: idColumn })
    .from(table as any)
    .where(and(inArray(idColumn, candidates), excludeDeleted && deletedAt ? isNull(deletedAt) : undefined));
  return new Set(rows.map((row) => String(row.id)));
}

/**
 * 既存の関連を残したまま、複数レコードに同じ関連先を足す / 外すための対象を絞る。
 * 追加は論理削除済みを対象にしない。削除は論理削除済みの行の関連も外せるようにする。
 */
async function resolveBulkRelationScope(
  executor: Pick<typeof db, "select">,
  relation: BelongsToManyRelationConfig<any>,
  source: { table: PgTable; idColumn: AnyPgColumn },
  ids: string[],
  targetIds: string[],
  excludeDeleted: boolean,
) {
  const { targetTable, targetIdColumn } = resolveRelationTarget(relation);
  const uniqueIds = [...new Set(ids)];
  const uniqueTargetIds = [...new Set(targetIds)];
  const existingIds = await selectExistingIds(executor, source.table, source.idColumn, uniqueIds, excludeDeleted);
  const existingTargetIds = await selectExistingIds(executor, targetTable, targetIdColumn, uniqueTargetIds, excludeDeleted);
  return {
    knownIds: uniqueIds.filter((id) => existingIds.has(id)),
    knownTargetIds: uniqueTargetIds.filter((id) => existingTargetIds.has(id)),
    unknownIds: uniqueIds.filter((id) => !existingIds.has(id)),
    unknownTargetIds: uniqueTargetIds.filter((id) => !existingTargetIds.has(id)),
  };
}

function toRelationResult(
  rows: { source_id: unknown }[],
  scope: { unknownIds: string[]; unknownTargetIds: string[] },
): BulkRelationResult {
  return {
    count: rows.length,
    affectedIds: [...new Set(rows.map((row) => String(row.source_id)))],
    unknownIds: scope.unknownIds,
    unknownTargetIds: scope.unknownTargetIds,
  };
}

/** 変わった行を source id ごとの target id にまとめる（監査の記録用） */
function groupTargetsBySource(rows: { source_id: unknown; target_id: unknown }[]): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const row of rows) {
    const sourceId = String(row.source_id);
    grouped.set(sourceId, [...(grouped.get(sourceId) ?? []), String(row.target_id)]);
  }
  return grouped;
}

/**
 * 全レコード × 全関連先を 1 文で足す。既にある組は何もしない。
 * 行を組み立てて values に渡すと 1000 × 50 × 2 列でパラメータ上限（65535）を超えるので、unnest で組む。
 */
export async function bulkAddBelongsToManyRelation(
  executor: Pick<typeof db, "select" | "execute">,
  relation: BelongsToManyRelationConfig<any>,
  source: { table: PgTable; idColumn: AnyPgColumn },
  ids: string[],
  targetIds: string[],
) {
  const scope = await resolveBulkRelationScope(executor, relation, source, ids, targetIds, true);
  if (!scope.knownIds.length || !scope.knownTargetIds.length) {
    return { result: toRelationResult([], scope), changes: new Map<string, string[]>() };
  }
  const sourceName = sql.identifier(relation.sourceColumn.name);
  const targetName = sql.identifier(relation.targetColumn.name);
  const toArray = (values: string[], column: AnyPgColumn) =>
    sql`ARRAY[${sql.join(values.map((value) => sql`${value}`), sql`, `)}]::${sql.raw(column.getSQLType())}[]`;
  const rows = (await executor.execute(sql`
    INSERT INTO ${relation.throughTable} (${sourceName}, ${targetName})
    SELECT s.id, t.id
    FROM unnest(${toArray(scope.knownIds, relation.sourceColumn)}) AS s(id)
    CROSS JOIN unnest(${toArray(scope.knownTargetIds, relation.targetColumn)}) AS t(id)
    ON CONFLICT DO NOTHING
    RETURNING ${sourceName} AS source_id, ${targetName} AS target_id
  `)) as unknown as { source_id: unknown; target_id: unknown }[];
  return { result: toRelationResult(rows, scope), changes: groupTargetsBySource(rows) };
}

/** 全レコードから指定の関連先だけを 1 文で外す。他の関連は残す */
export async function bulkRemoveBelongsToManyRelation(
  executor: Pick<typeof db, "select" | "delete">,
  relation: BelongsToManyRelationConfig<any>,
  source: { table: PgTable; idColumn: AnyPgColumn },
  ids: string[],
  targetIds: string[],
) {
  const scope = await resolveBulkRelationScope(executor, relation, source, ids, targetIds, false);
  if (!scope.knownIds.length || !scope.knownTargetIds.length) {
    return { result: toRelationResult([], scope), changes: new Map<string, string[]>() };
  }
  const rows = (await executor
    .delete(relation.throughTable)
    .where(and(inArray(relation.sourceColumn, scope.knownIds), inArray(relation.targetColumn, scope.knownTargetIds)))
    .returning({ source_id: relation.sourceColumn, target_id: relation.targetColumn })) as {
    source_id: unknown;
    target_id: unknown;
  }[];
  return { result: toRelationResult(rows, scope), changes: groupTargetsBySource(rows) };
}

export function assignLocalRelationValues<TRecord extends Record<string, any>>(
  record: TRecord,
  relations: Array<BelongsToManyRelationConfig<any>>,
  relationValues: RelationValueMap,
) {
  if (!relations.length || !relationValues.size) return record;

  relations.forEach((relation) => {
    if (!relationValues.has(relation.fieldName)) return;
    Object.assign(record, {
      [relation.fieldName]: relationValues.get(relation.fieldName) ?? [],
    });
  });

  return record;
}

export async function hydrateBelongsToManyRelations<TRecord extends Record<string, any>>(
  records: TRecord[],
  relations: Array<BelongsToManyRelationConfig<any>>,
) {
  if (!relations.length || records.length === 0) {
    return records;
  }

  const ids = records
    .map((record) => record.id)
    .filter((id): id is string | number => typeof id === "string" || typeof id === "number");
  if (!ids.length) return records;

  await Promise.all(
    relations.map(async (relation) => {
      const rows = await db
        .select({
          sourceId: relation.sourceColumn,
          targetId: relation.targetColumn,
        })
        .from(relation.throughTable)
        .where(inArray(relation.sourceColumn, ids));

      const grouped = new Map<string | number, unknown[]>();
      rows.forEach((row) => {
        const sourceId = row.sourceId;
        if (typeof sourceId !== "string" && typeof sourceId !== "number") return;
        const valueList = grouped.get(sourceId) ?? [];
        valueList.push(row.targetId);
        grouped.set(sourceId, valueList);
      });

      records.forEach((record) => {
        if (record.id === undefined || record.id === null) return;
        const related = grouped.get(record.id) ?? [];
        Object.assign(record, { [relation.fieldName]: related });
      });
    }),
  );

  return records;
}
