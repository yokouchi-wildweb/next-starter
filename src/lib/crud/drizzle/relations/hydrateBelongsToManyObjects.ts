// src/lib/crud/drizzle/relations/hydrateBelongsToManyObjects.ts

import { db } from "@/lib/drizzle";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { BelongsToRelation, BelongsToManyObjectRelation, HasManyRelation } from "@/lib/crud/types";

/**
 * belongsToMany リレーションをオブジェクト配列で展開する。
 * 中間テーブルを経由してリレーション先のオブジェクト配列を取得して付与する。
 *
 * @param records - 対象レコード配列
 * @param relations - リレーション設定配列
 * @param depth - 展開する残り深さ（1 = 現在階層のみ、2 = ネストも展開）
 * @param hydrateBelongsTo - belongsTo展開関数（循環参照回避のため引数で渡す）
 *
 * @example
 * // 入力: { id: "1", name: "サンプル", sample_tag_ids: ["tag-1", "tag-2"] }
 * // 出力: { id: "1", name: "サンプル", sample_tag_ids: ["tag-1", "tag-2"], sample_tags: [{ id: "tag-1", name: "タグA" }, { id: "tag-2", name: "タグB" }] }
 */
export async function hydrateBelongsToManyObjects<T extends Record<string, any>>(
  records: T[],
  relations: BelongsToManyObjectRelation[],
  depth: number = 1,
  hydrateBelongsTo?: (
    records: Record<string, any>[],
    relations: BelongsToRelation[],
    depth: number,
    hydrateBelongsToMany?: (
      records: Record<string, any>[],
      relations: BelongsToManyObjectRelation[],
      depth: number,
    ) => Promise<void>,
    hydrateHasManyFn?: (
      records: Record<string, any>[],
      relations: HasManyRelation[],
      depth: number,
    ) => Promise<void>,
  ) => Promise<void>,
  hydrateHasManyFn?: (
    records: Record<string, any>[],
    relations: HasManyRelation[],
    depth: number,
  ) => Promise<void>,
): Promise<void> {
  if (records.length === 0 || relations.length === 0 || depth < 1) return;

  for (const rel of relations) {
    // 1. 全レコードのIDを収集
    const recordIds = records
      .map((r) => r.id)
      .filter((id): id is string => id != null);

    if (recordIds.length === 0) {
      for (const record of records) {
        (record as any)[rel.field] = [];
        if (rel.idField) {
          (record as any)[rel.idField] = [];
        }
      }
      continue;
    }

    const softDeleteFilter =
      rel.useSoftDelete && rel.deletedAtColumn
        ? isNull(rel.deletedAtColumn)
        : undefined;

    // 2. 中間テーブル + ターゲットテーブルをJOINで取得
    // sourceColumn: SampleToSampleTagTable.sampleId
    // targetColumn: SampleToSampleTagTable.sampleTagId
    // targetTable: SampleTagTable
    const joinedRecords = await db
      .select({
        sourceId: rel.sourceColumn,
        target: rel.targetTable,
      })
      .from(rel.throughTable)
      .innerJoin(
        rel.targetTable,
        eq(rel.targetColumn, rel.targetTable.id)
      )
      .where(
        softDeleteFilter
          ? and(inArray(rel.sourceColumn, recordIds), softDeleteFilter)
          : inArray(rel.sourceColumn, recordIds),
      );

    // 3. sourceId でグルーピング（オブジェクト配列 + ID 配列を同時に構築）
    const grouped = new Map<string, any[]>();
    const groupedIds = new Map<string, string[]>();
    for (const jr of joinedRecords) {
      const sourceId = jr.sourceId as string;
      const list = grouped.get(sourceId) ?? [];
      list.push(jr.target);
      grouped.set(sourceId, list);

      if (rel.idField) {
        const idList = groupedIds.get(sourceId) ?? [];
        idList.push((jr.target as { id: string }).id);
        groupedIds.set(sourceId, idList);
      }
    }

    // 4. 各レコードに紐付け（idField 指定時は *_ids も併せて格納）
    for (const record of records) {
      (record as any)[rel.field] = grouped.get(record.id) ?? [];
      if (rel.idField) {
        (record as any)[rel.idField] = groupedIds.get(record.id) ?? [];
      }
    }

    // 5. 2階層目の展開（depth > 1 かつ nested 設定がある場合）
    if (depth > 1 && rel.nested) {
      // リレーション先の全レコードを収集（フラット化）
      const nestedRecords: Record<string, any>[] = [];
      for (const record of records) {
        const items = (record as any)[rel.field];
        if (Array.isArray(items)) {
          nestedRecords.push(...items);
        }
      }

      if (nestedRecords.length > 0) {
        // belongsTo のネスト展開
        if (hydrateBelongsTo && rel.nested.belongsTo && rel.nested.belongsTo.length > 0) {
          // hydrateBelongsToManyをラップして渡す
          const wrappedHydrateBelongsToMany = async (
            recs: Record<string, any>[],
            rels: BelongsToManyObjectRelation[],
            d: number,
          ) => {
            await hydrateBelongsToManyObjects(recs, rels, d, hydrateBelongsTo);
          };

          await hydrateBelongsTo(
            nestedRecords,
            rel.nested.belongsTo,
            depth - 1,
            wrappedHydrateBelongsToMany,
            hydrateHasManyFn,
          );
        }

        // belongsToMany のネスト展開
        if (rel.nested.belongsToMany && rel.nested.belongsToMany.length > 0) {
          await hydrateBelongsToManyObjects(
            nestedRecords,
            rel.nested.belongsToMany,
            depth - 1,
            hydrateBelongsTo,
            hydrateHasManyFn,
          );
        }

        // hasMany のネスト展開
        if (hydrateHasManyFn && rel.nested.hasMany && rel.nested.hasMany.length > 0) {
          await hydrateHasManyFn(
            nestedRecords,
            rel.nested.hasMany,
            depth - 1,
          );
        }
      }
    }
  }
}
