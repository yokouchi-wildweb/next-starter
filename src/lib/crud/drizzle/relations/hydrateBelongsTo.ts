// src/lib/crud/drizzle/relations/hydrateBelongsTo.ts

import { db } from "@/lib/drizzle";
import { inArray } from "drizzle-orm";
import type { BelongsToRelation } from "@/lib/crud/types";

/**
 * belongsTo リレーションを展開する。
 * 外部キー（例: sample_category_id）からリレーション先のオブジェクト（例: sample_category）を取得して付与する。
 *
 * @example
 * // 入力: { id: "1", sample_category_id: "cat-1", name: "サンプル" }
 * // 出力: { id: "1", sample_category_id: "cat-1", name: "サンプル", sample_category: { id: "cat-1", name: "カテゴリA" } }
 */
export async function hydrateBelongsTo<T extends Record<string, any>>(
  records: T[],
  relations: BelongsToRelation[],
): Promise<void> {
  if (records.length === 0 || relations.length === 0) return;

  for (const rel of relations) {
    // 1. 全レコードから外部キーを収集（重複除去、null/undefined除外）
    const foreignKeys = [
      ...new Set(
        records
          .map((r) => r[rel.foreignKey])
          .filter((fk): fk is string => fk != null && fk !== "")
      ),
    ];

    if (foreignKeys.length === 0) {
      // 全レコードに null を設定
      for (const record of records) {
        (record as any)[rel.field] = null;
      }
      continue;
    }

    // 2. IN句で一括取得
    const relatedRecords = await db
      .select()
      .from(rel.table)
      .where(inArray(rel.table.id, foreignKeys));

    // 3. Map化してO(1)で参照
    const relatedMap = new Map(
      relatedRecords.map((r: any) => [r.id, r])
    );

    // 4. 各レコードに紐付け
    for (const record of records) {
      const fk = record[rel.foreignKey];
      (record as any)[rel.field] = fk ? relatedMap.get(fk) ?? null : null;
    }
  }
}
