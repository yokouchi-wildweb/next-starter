// src/lib/crud/drizzle/relations/hydrateBelongsTo.ts

import { db } from "@/lib/drizzle";
import { inArray } from "drizzle-orm";
import type { BelongsToRelation, BelongsToManyObjectRelation } from "@/lib/crud/types";

/**
 * belongsTo リレーションを展開する。
 * 外部キー（例: sample_category_id）からリレーション先のオブジェクト（例: sample_category）を取得して付与する。
 *
 * @param records - 対象レコード配列
 * @param relations - リレーション設定配列
 * @param depth - 展開する残り深さ（1 = 現在階層のみ、2 = ネストも展開）
 * @param hydrateBelongsToMany - belongsToMany展開関数（循環参照回避のため引数で渡す）
 *
 * @example
 * // 入力: { id: "1", sample_category_id: "cat-1", name: "サンプル" }
 * // 出力: { id: "1", sample_category_id: "cat-1", name: "サンプル", sample_category: { id: "cat-1", name: "カテゴリA" } }
 */
export async function hydrateBelongsTo<T extends Record<string, any>>(
  records: T[],
  relations: BelongsToRelation[],
  depth: number = 1,
  hydrateBelongsToMany?: (
    records: Record<string, any>[],
    relations: BelongsToManyObjectRelation[],
    depth: number,
  ) => Promise<void>,
): Promise<void> {
  if (records.length === 0 || relations.length === 0 || depth < 1) return;

  // 1階層目のデータ取得を全リレーション並列で実行
  await Promise.all(
    relations.map(async (rel) => {
      const foreignKeys = [
        ...new Set(
          records
            .map((r) => r[rel.foreignKey])
            .filter((fk): fk is string => fk != null && fk !== "")
        ),
      ];

      if (foreignKeys.length === 0) {
        for (const record of records) {
          (record as any)[rel.field] = null;
        }
        return;
      }

      const relatedRecords = await db
        .select()
        .from(rel.table)
        .where(inArray(rel.table.id, foreignKeys));

      const relatedMap = new Map(
        relatedRecords.map((r: any) => [r.id, r])
      );

      for (const record of records) {
        const fk = record[rel.foreignKey];
        (record as any)[rel.field] = fk ? relatedMap.get(fk) ?? null : null;
      }
    }),
  );

  // 2階層目のネスト展開（1階層目の取得完了後に実行）
  for (const rel of relations) {
    if (depth <= 1 || !rel.nested) continue;

    const nestedRecords = records
      .map((r) => r[rel.field])
      .filter((r): r is Record<string, any> => r != null);

    if (nestedRecords.length === 0) continue;

    if (rel.nested.belongsTo && rel.nested.belongsTo.length > 0) {
      await hydrateBelongsTo(
        nestedRecords,
        rel.nested.belongsTo,
        depth - 1,
        hydrateBelongsToMany,
      );
    }

    if (hydrateBelongsToMany && rel.nested.belongsToMany && rel.nested.belongsToMany.length > 0) {
      await hydrateBelongsToMany(
        nestedRecords,
        rel.nested.belongsToMany,
        depth - 1,
      );
    }
  }
}
