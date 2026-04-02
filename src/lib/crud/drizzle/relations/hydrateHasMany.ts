// src/lib/crud/drizzle/relations/hydrateHasMany.ts

import { db } from "@/lib/drizzle";
import { inArray, asc } from "drizzle-orm";
import type { HasManyRelation, BelongsToRelation, BelongsToManyObjectRelation } from "@/lib/crud/types";

/** hasMany 展開時の親レコードあたりのデフォルト取得上限 */
export const DEFAULT_HAS_MANY_LIMIT = 100;

/**
 * hasMany リレーションを展開する。
 * 親レコードのIDから子テーブルを検索し、子レコードの配列を付与する。
 *
 * @param records - 対象レコード配列（親側）
 * @param relations - hasMany リレーション設定配列
 * @param depth - 展開する残り深さ（1 = 現在階層のみ、2 = ネストも展開）
 * @param limit - 親レコードあたりの子レコード取得上限
 * @param hydrateBelongsTo - belongsTo展開関数（ネスト展開用）
 * @param hydrateBelongsToMany - belongsToMany展開関数（ネスト展開用）
 *
 * @example
 * // 入力: { id: "cat-1", name: "カテゴリA" }
 * // 出力: { id: "cat-1", name: "カテゴリA", samples: [{ id: "1", name: "サンプル1", sample_category_id: "cat-1" }, ...] }
 */
export async function hydrateHasMany<T extends Record<string, any>>(
  records: T[],
  relations: HasManyRelation[],
  depth: number = 1,
  limit: number = DEFAULT_HAS_MANY_LIMIT,
  hydrateBelongsTo?: (
    records: Record<string, any>[],
    relations: BelongsToRelation[],
    depth: number,
    hydrateBelongsToMany?: (
      records: Record<string, any>[],
      relations: BelongsToManyObjectRelation[],
      depth: number,
    ) => Promise<void>,
  ) => Promise<void>,
  hydrateBelongsToMany?: (
    records: Record<string, any>[],
    relations: BelongsToManyObjectRelation[],
    depth: number,
    hydrateBelongsTo?: (
      records: Record<string, any>[],
      relations: BelongsToRelation[],
      depth: number,
      hydrateBelongsToMany?: (
        records: Record<string, any>[],
        relations: BelongsToManyObjectRelation[],
        depth: number,
      ) => Promise<void>,
    ) => Promise<void>,
  ) => Promise<void>,
): Promise<void> {
  if (records.length === 0 || relations.length === 0 || depth < 1) return;

  // 1階層目のデータ取得を全リレーション並列で実行
  await Promise.all(
    relations.map(async (rel) => {
      const parentIds = [
        ...new Set(
          records
            .map((r) => r.id)
            .filter((id): id is string => id != null && id !== "")
        ),
      ];

      if (parentIds.length === 0) {
        for (const record of records) {
          (record as any)[rel.field] = [];
        }
        return;
      }

      // 子テーブルから一括取得（親数 × limit で全体上限を設定）
      const childRecords = await db
        .select()
        .from(rel.table)
        .where(inArray(rel.table[rel.foreignKey], parentIds))
        .orderBy(asc(rel.table.id))
        .limit(parentIds.length * limit);

      // 親IDでグルーピング（親あたり limit 件まで）
      const grouped = new Map<string, any[]>();
      for (const child of childRecords) {
        const parentId = child[rel.foreignKey] as string;
        const list = grouped.get(parentId) ?? [];
        if (list.length < limit) {
          list.push(child);
          grouped.set(parentId, list);
        }
      }

      // 各親レコードに紐付け
      for (const record of records) {
        (record as any)[rel.field] = grouped.get(record.id) ?? [];
      }
    }),
  );

  // 2階層目のネスト展開（1階層目の取得完了後に実行）
  for (const rel of relations) {
    if (depth <= 1 || !rel.nested) continue;

    const nestedRecords: Record<string, any>[] = records.flatMap((r) => {
      const items = (r as any)[rel.field];
      return Array.isArray(items) ? items : [];
    });

    if (nestedRecords.length === 0) continue;

    if (hydrateBelongsTo && rel.nested.belongsTo && rel.nested.belongsTo.length > 0) {
      // hydrateBelongsToMany をラップして渡す
      const wrappedHydrateBelongsToMany = hydrateBelongsToMany
        ? async (
            recs: Record<string, any>[],
            rels: BelongsToManyObjectRelation[],
            d: number,
          ) => {
            await hydrateBelongsToMany(recs, rels, d, hydrateBelongsTo);
          }
        : undefined;

      await hydrateBelongsTo(
        nestedRecords,
        rel.nested.belongsTo,
        depth - 1,
        wrappedHydrateBelongsToMany,
      );
    }

    if (hydrateBelongsToMany && rel.nested.belongsToMany && rel.nested.belongsToMany.length > 0) {
      await hydrateBelongsToMany(
        nestedRecords,
        rel.nested.belongsToMany,
        depth - 1,
        hydrateBelongsTo,
      );
    }

    // hasMany のネスト展開（再帰）
    if (rel.nested.hasMany && rel.nested.hasMany.length > 0) {
      await hydrateHasMany(
        nestedRecords,
        rel.nested.hasMany,
        depth - 1,
        limit,
        hydrateBelongsTo,
        hydrateBelongsToMany,
      );
    }
  }
}
