// src/lib/crud/drizzle/relations/hydrateBelongsToManyObjects.ts

import { db } from "@/lib/drizzle";
import { eq, inArray } from "drizzle-orm";
import type { BelongsToManyObjectRelation } from "@/lib/crud/types";

/**
 * belongsToMany リレーションをオブジェクト配列で展開する。
 * 中間テーブルを経由してリレーション先のオブジェクト配列を取得して付与する。
 *
 * @example
 * // 入力: { id: "1", name: "サンプル", sample_tag_ids: ["tag-1", "tag-2"] }
 * // 出力: { id: "1", name: "サンプル", sample_tag_ids: ["tag-1", "tag-2"], sample_tags: [{ id: "tag-1", name: "タグA" }, { id: "tag-2", name: "タグB" }] }
 */
export async function hydrateBelongsToManyObjects<T extends Record<string, any>>(
  records: T[],
  relations: BelongsToManyObjectRelation[],
): Promise<void> {
  if (records.length === 0 || relations.length === 0) return;

  for (const rel of relations) {
    // 1. 全レコードのIDを収集
    const recordIds = records
      .map((r) => r.id)
      .filter((id): id is string => id != null);

    if (recordIds.length === 0) {
      for (const record of records) {
        (record as any)[rel.field] = [];
      }
      continue;
    }

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
      .where(inArray(rel.sourceColumn, recordIds));

    // 3. sourceId でグルーピング
    const grouped = new Map<string, any[]>();
    for (const jr of joinedRecords) {
      const sourceId = jr.sourceId as string;
      const list = grouped.get(sourceId) ?? [];
      list.push(jr.target);
      grouped.set(sourceId, list);
    }

    // 4. 各レコードに紐付け
    for (const record of records) {
      (record as any)[rel.field] = grouped.get(record.id) ?? [];
    }
  }
}
