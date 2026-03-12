import { and, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { BelongsToManyFilter, BelongsToFilter, RelationFilter, BelongsToRelation } from "@/lib/crud/types";
import type { BelongsToManyRelationConfig } from "@/lib/crud/drizzle/types";
import { buildWhere } from "./buildWhere";

// ============================================================
// 型ガード
// ============================================================

function isBelongsToManyFilter(filter: RelationFilter): filter is BelongsToManyFilter {
  return "targetIds" in filter;
}

function isBelongsToFilter(filter: RelationFilter): filter is BelongsToFilter {
  return "where" in filter;
}

// ============================================================
// belongsToMany フィルタ → SQL
// ============================================================

function buildBelongsToManyCondition(
  mainTableIdColumn: AnyPgColumn,
  filter: BelongsToManyFilter,
  relations: Array<BelongsToManyRelationConfig<any>>,
): SQL | undefined {
  // 空配列はスキップ（no-op）
  if (!filter.targetIds.length) return undefined;

  const config = relations.find((r) => r.fieldName === filter.relationField);
  if (!config) {
    const available = relations.map((r) => r.fieldName).join(", ");
    throw new Error(
      `relationWhere: unknown relationField "${filter.relationField}". ` +
        `Available: ${available}`,
    );
  }

  const mode = filter.mode ?? "any";
  const { throughTable, sourceColumn, targetColumn } = config;
  const targetIdsList = sql.join(
    filter.targetIds.map((id) => sql`${id}`),
    sql`, `,
  );

  switch (mode) {
    case "any":
      return sql`EXISTS (SELECT 1 FROM ${throughTable} WHERE ${sourceColumn} = ${mainTableIdColumn} AND ${targetColumn} IN (${targetIdsList}))`;
    case "all":
      return sql`(SELECT COUNT(DISTINCT ${targetColumn}) FROM ${throughTable} WHERE ${sourceColumn} = ${mainTableIdColumn} AND ${targetColumn} IN (${targetIdsList})) = ${filter.targetIds.length}`;
    case "none":
      return sql`NOT EXISTS (SELECT 1 FROM ${throughTable} WHERE ${sourceColumn} = ${mainTableIdColumn} AND ${targetColumn} IN (${targetIdsList}))`;
  }
}

// ============================================================
// belongsTo フィルタ → SQL
// ============================================================

function buildBelongsToCondition(
  mainTable: any,
  filter: BelongsToFilter,
  relations: BelongsToRelation[],
): SQL {
  const config = relations.find((r) => r.field === filter.relationField);
  if (!config) {
    const available = relations.map((r) => r.field).join(", ");
    throw new Error(
      `relationWhere: unknown relationField "${filter.relationField}". ` +
        `Available: ${available}`,
    );
  }

  const relatedTable = config.table;
  const foreignKeyColumn = mainTable[config.foreignKey];
  const whereCondition = buildWhere(relatedTable, filter.where);

  return sql`EXISTS (SELECT 1 FROM ${relatedTable} WHERE ${(relatedTable as any).id} = ${foreignKeyColumn} AND ${whereCondition})`;
}

// ============================================================
// 統合エントリポイント
// ============================================================

/**
 * リレーションフィルタを Drizzle SQL 条件に変換する。
 *
 * belongsToMany（M2M）:
 * - "any":  いずれかの targetId を持つレコードに一致（EXISTS）
 * - "all":  すべての targetId を持つレコードに一致（COUNT(DISTINCT) = N）
 * - "none": いずれの targetId も持たないレコードに一致（NOT EXISTS）
 *
 * belongsTo:
 * - リレーション先テーブルのカラム条件で EXISTS フィルタを生成
 *
 * 複数フィルタは AND で合成される。
 */
export function buildRelationWhere(
  mainTable: any,
  mainTableIdColumn: AnyPgColumn,
  filters: RelationFilter[],
  belongsToManyRelations: Array<BelongsToManyRelationConfig<any>>,
  belongsToRelations: BelongsToRelation[],
): SQL | undefined {
  if (!filters.length) return undefined;

  const conditions: SQL[] = [];

  for (const filter of filters) {
    if (isBelongsToManyFilter(filter)) {
      const condition = buildBelongsToManyCondition(mainTableIdColumn, filter, belongsToManyRelations);
      if (condition) conditions.push(condition);
    } else if (isBelongsToFilter(filter)) {
      conditions.push(buildBelongsToCondition(mainTable, filter, belongsToRelations));
    }
  }

  if (!conditions.length) return undefined;
  if (conditions.length === 1) return conditions[0];
  return and(...conditions) as SQL;
}
