// src/lib/crud/drizzle/service/sort.ts
// 並び替えの群(Fractional Indexing): reorder / initializeSortOrder

import { db } from "@/lib/drizzle";
import { eq, inArray, sql } from "drizzle-orm";
import { generateSortKey, generateFirstSortKey, generateLastSortKeys } from "../fractionalSort";
import { DomainError } from "@/lib/errors";
import type { InferSelectModel } from "drizzle-orm";
import type { PgTable, AnyPgColumn, PgUpdateSetSource } from "drizzle-orm/pg-core";
import type { DbTransaction } from "../types";
import { hydrateBelongsToManyRelations } from "../belongsToMany";
import { sortKeyAsc, sortKeyDesc, sortKeyGt } from "../fractionalSort/sortKeyOrder";
import type { ServiceContext } from "./context";

export function createSortMethods<TTable extends PgTable & { id: AnyPgColumn }, TCreate extends Record<string, any>>(ctx: ServiceContext<TTable, TCreate>) {
  type Select = InferSelectModel<TTable>;
  const { table, serviceOptions, idColumn, belongsToManyRelations, sortOrderColumn } = ctx;
  return {
    /**
     * レコードの並び順を変更する（Fractional Indexing）
     *
     * @param id - 移動するレコードのID
     * @param afterItemId - 移動先の直前のレコードID（nullで先頭に移動）
     * @returns 更新されたレコード
     * @throws sortOrderColumn が設定されていない場合
     *
     * @example
     * ```ts
     * // レコードDをレコードAの直後に移動
     * await service.reorder("D", "A");
     *
     * // レコードを先頭に移動
     * await service.reorder("D", null);
     * ```
     */
    async reorder(id: string, afterItemId: string | null, tx?: DbTransaction): Promise<Select> {
      if (!sortOrderColumn) {
        throw new Error(
          "reorder() requires sortOrderColumn to be configured in service options."
        );
      }

      const executor = tx ?? db;

      // 新しい sortOrder を計算
      let newSortOrder: string;

      if (!afterItemId) {
        // 先頭に移動: 最も小さい sortOrder を持つレコードを取得
        const firstResults = await executor
          .select({ sortOrder: sortOrderColumn })
          .from(table as any)
          .orderBy(sortKeyAsc(sortOrderColumn))
          .limit(1) as { sortOrder: string | null }[];

        const firstSortOrder = firstResults[0]?.sortOrder ?? null;
        newSortOrder = generateFirstSortKey(firstSortOrder);
      } else {
        // afterItem の sortOrder を取得
        const afterResults = await executor
          .select({ sortOrder: sortOrderColumn })
          .from(table as any)
          .where(eq(idColumn, afterItemId))
          .limit(1) as { sortOrder: string | null }[];

        const afterSortOrder = afterResults[0]?.sortOrder ?? null;

        if (!afterSortOrder) {
          // afterItem が見つからない場合は先頭に配置
          newSortOrder = generateFirstSortKey(null);
        } else {
          // afterItem より大きい sortOrder を持つ最初のレコードを取得
          const nextResults = await executor
            .select({ sortOrder: sortOrderColumn })
            .from(table as any)
            .where(sortKeyGt(sortOrderColumn, afterSortOrder))
            .orderBy(sortKeyAsc(sortOrderColumn))
            .limit(1) as { sortOrder: string | null }[];

          const nextSortOrder = nextResults[0]?.sortOrder ?? null;
          newSortOrder = generateSortKey(afterSortOrder, nextSortOrder);
        }
      }

      // sortOrder を更新
      // sortOrderColumn.name でDBカラム名を取得（snake_case）
      const sortOrderFieldName = (sortOrderColumn as any).name as string;
      const updateData = { [sortOrderFieldName]: newSortOrder } as Record<string, any>;
      if (serviceOptions.useUpdatedAt) {
        updateData.updatedAt = new Date();
      }

      const rows = await executor
        .update(table)
        .set(updateData)
        .where(eq(idColumn, id))
        .returning();

      const record = rows[0] as Select;
      if (!record) {
        throw new DomainError(`レコードが見つかりません: ${id}`, { status: 404 });
      }

      // belongsToMany の hydrate
      if (belongsToManyRelations.length) {
        await hydrateBelongsToManyRelations([record], belongsToManyRelations);
      }

      return record;
    },
    /**
     * 指定されたIDのレコードに sort_order を初期化する。
     * 渡された順序を維持し、既存の最大 sort_order の後に配置する。
     *
     * @param ids - 初期化対象のレコードID配列（この順序で sort_order を付与）
     * @param tx - オプションのトランザクション
     * @returns ID → 割り当てられた sort_order のマップ
     */
    async initializeSortOrder(ids: string[], tx?: DbTransaction): Promise<Map<string, string>> {
      if (!sortOrderColumn || ids.length === 0) return new Map();

      const sortOrderFieldName = (sortOrderColumn as any).name as string;
      const executor = tx ?? db;

      // 現在の最大 sortOrder を取得
      const maxResults = await executor
        .select({ sortOrder: sortOrderColumn })
        .from(table as any)
        .where(sql`${sortOrderColumn} IS NOT NULL`)
        .orderBy(sortKeyDesc(sortOrderColumn))
        .limit(1) as { sortOrder: string | null }[];

      const prevKey = maxResults[0]?.sortOrder ?? null;

      // メモリ上で全キーを一括生成
      const newKeys = generateLastSortKeys(prevKey, ids.length);
      const keyMap = new Map<string, string>();
      ids.forEach((id, i) => keyMap.set(id, newKeys[i]!));

      // 1クエリでバッチUPDATE: UPDATE table SET sort_order = CASE id WHEN ... END
      const updatedAt = serviceOptions.useUpdatedAt ? new Date() : undefined;
      const caseFragments = ids.map((id, i) =>
        sql`WHEN ${id} THEN ${newKeys[i]!}`
      );
      const caseExpr = sql.join([
        sql`CASE ${idColumn}`,
        ...caseFragments,
        sql`END`,
      ], sql` `);

      const setClause: Record<string, any> = {
        [sortOrderFieldName]: caseExpr,
      };
      if (updatedAt) {
        setClause.updatedAt = updatedAt;
      }

      await executor
        .update(table)
        .set(setClause as PgUpdateSetSource<TTable>)
        .where(inArray(idColumn, ids));

      return keyMap;
    },
  };
}
