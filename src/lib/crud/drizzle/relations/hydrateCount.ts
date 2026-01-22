// src/lib/crud/drizzle/relations/hydrateCount.ts

import { db } from "@/lib/drizzle";
import { inArray, sql } from "drizzle-orm";
import type { CountableRelation } from "@/lib/crud/types";

/**
 * リレーション先のレコード数を _count に追加する。
 * belongsToMany の中間テーブルを使用してカウントを取得する。
 *
 * @example
 * // 入力: { id: "1", name: "サンプル" }
 * // 出力: { id: "1", name: "サンプル", _count: { sample_tags: 5 } }
 */
export async function hydrateCount<T extends Record<string, any>>(
  records: T[],
  relations: CountableRelation[],
): Promise<void> {
  if (records.length === 0 || relations.length === 0) return;

  // 全レコードのIDを収集
  const recordIds = records
    .map((r) => r.id)
    .filter((id): id is string => id != null);

  if (recordIds.length === 0) {
    // 全レコードに空の _count を設定
    for (const record of records) {
      (record as any)._count = {};
    }
    return;
  }

  // 各レコードに _count オブジェクトを初期化
  for (const record of records) {
    if (!(record as any)._count) {
      (record as any)._count = {};
    }
  }

  for (const rel of relations) {
    // 中間テーブルの外部キーカラムを取得
    const foreignKeyColumn = (rel.throughTable as any)[rel.foreignKey];

    if (!foreignKeyColumn) {
      console.warn(`hydrateCount: foreignKey "${rel.foreignKey}" not found in throughTable`);
      // 全レコードに 0 を設定
      for (const record of records) {
        (record as any)._count[rel.field] = 0;
      }
      continue;
    }

    // GROUP BY + COUNT で一括取得
    const counts = await db
      .select({
        sourceId: foreignKeyColumn,
        count: sql<number>`count(*)`.as("count"),
      })
      .from(rel.throughTable)
      .where(inArray(foreignKeyColumn, recordIds))
      .groupBy(foreignKeyColumn);

    // Map化
    const countMap = new Map(
      counts.map((c) => [c.sourceId as string, Number(c.count)])
    );

    // 各レコードに紐付け
    for (const record of records) {
      (record as any)._count[rel.field] = countMap.get(record.id) ?? 0;
    }
  }
}
