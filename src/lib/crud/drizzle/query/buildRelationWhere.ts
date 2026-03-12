import { and, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { BelongsToManyFilter } from "@/lib/crud/types";
import type { BelongsToManyRelationConfig } from "@/lib/crud/drizzle/types";

/**
 * belongsToMany リレーションフィルタを Drizzle SQL 条件に変換する。
 *
 * - "any":  いずれかの targetId を持つレコードに一致（EXISTS）
 * - "all":  すべての targetId を持つレコードに一致（COUNT(DISTINCT) = N）
 * - "none": いずれの targetId も持たないレコードに一致（NOT EXISTS）
 *
 * targetIds が空配列のフィルタはスキップする。
 * 複数フィルタは AND で合成される。
 */
export function buildRelationWhere(
  mainTableIdColumn: AnyPgColumn,
  filters: BelongsToManyFilter[],
  relations: Array<BelongsToManyRelationConfig<any>>,
): SQL | undefined {
  if (!filters.length || !relations.length) return undefined;

  const conditions: SQL[] = [];

  for (const filter of filters) {
    // 空配列はスキップ（no-op）
    if (!filter.targetIds.length) continue;

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
        conditions.push(
          sql`EXISTS (SELECT 1 FROM ${throughTable} WHERE ${sourceColumn} = ${mainTableIdColumn} AND ${targetColumn} IN (${targetIdsList}))`,
        );
        break;
      case "all":
        conditions.push(
          sql`(SELECT COUNT(DISTINCT ${targetColumn}) FROM ${throughTable} WHERE ${sourceColumn} = ${mainTableIdColumn} AND ${targetColumn} IN (${targetIdsList})) = ${filter.targetIds.length}`,
        );
        break;
      case "none":
        conditions.push(
          sql`NOT EXISTS (SELECT 1 FROM ${throughTable} WHERE ${sourceColumn} = ${mainTableIdColumn} AND ${targetColumn} IN (${targetIdsList}))`,
        );
        break;
    }
  }

  if (!conditions.length) return undefined;
  if (conditions.length === 1) return conditions[0];
  return and(...conditions) as SQL;
}
