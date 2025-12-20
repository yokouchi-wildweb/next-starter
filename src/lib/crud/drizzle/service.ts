// src/lib/crud/drizzle/service.ts

import { db } from "@/lib/drizzle";
import { omitUndefined } from "@/utils/object";
import { eq, inArray, SQL, ilike, and, or, sql, isNull, asc } from "drizzle-orm";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { PgTable, AnyPgColumn, PgUpdateSetSource, PgTimestampString } from "drizzle-orm/pg-core";
import type { SearchParams, PaginatedResult, UpsertOptions, WhereExpr } from "../types";
import { buildOrderBy, buildWhere, runQuery } from "./query";
import { applyInsertDefaults, resolveConflictTarget } from "./utils";
import type { DrizzleCrudServiceOptions, DbTransaction } from "./types";
import {
  assignLocalRelationValues,
  hydrateBelongsToManyRelations,
  separateBelongsToManyInput,
  syncBelongsToManyRelations,
} from "./belongsToMany";

const resolveRecordId = (value: unknown): string | number | undefined => {
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  return undefined;
};

export type DefaultInsert<TTable extends PgTable> = Omit<
  InferInsertModel<TTable>,
  "id" | "createdAt" | "updatedAt"
>;

export function createCrudService<
  TTable extends PgTable & { id: AnyPgColumn },
  TCreate extends Record<string, any> = DefaultInsert<TTable>
>(table: TTable, serviceOptions: DrizzleCrudServiceOptions<TCreate> = {}) {
  type Select = InferSelectModel<TTable>;
  type Insert = TCreate;
  const idColumn = table.id;
  const belongsToManyRelations = serviceOptions.belongsToManyRelations ?? [];
  const useSoftDelete = serviceOptions.useSoftDelete ?? false;
  // ソフトデリート用カラム（テーブルに deletedAt がある場合のみ）
  const deletedAtColumn = useSoftDelete
    ? ((table as any).deletedAt as AnyPgColumn | undefined)
    : undefined;

  // ソフトデリート用のフィルター条件を生成
  const buildSoftDeleteFilter = (): SQL | undefined => {
    if (!deletedAtColumn) return undefined;
    return isNull(deletedAtColumn);
  };

  return {
    async create(data: Insert, tx?: DbTransaction): Promise<Select> {
      const parsedInput = serviceOptions.parseCreate
        ? await serviceOptions.parseCreate(data)
        : data;
      const { sanitizedData, relationValues } = separateBelongsToManyInput(
        parsedInput,
        belongsToManyRelations,
      );
      const finalInsert = applyInsertDefaults(sanitizedData as Insert, serviceOptions) as Insert;

      // belongsToMany がない場合
      if (!belongsToManyRelations.length) {
        const executor = tx ?? db;
        const rows = await executor.insert(table).values(finalInsert).returning();
        return rows[0] as Select;
      }

      // belongsToMany があり、外部トランザクションが渡された場合
      if (tx) {
        const rows = await tx.insert(table).values(finalInsert).returning();
        const created = rows[0] as Select;
        if (!created) return created;
        const relationRecordId = resolveRecordId(created.id as unknown);
        if (relationRecordId !== undefined) {
          await syncBelongsToManyRelations(tx, belongsToManyRelations, relationRecordId, relationValues);
        }
        assignLocalRelationValues(created, belongsToManyRelations, relationValues);
        return created;
      }

      // belongsToMany があり、外部トランザクションがない場合は内部トランザクション
      return db.transaction(async (innerTx) => {
        const rows = await innerTx.insert(table).values(finalInsert).returning();
        const created = rows[0] as Select;
        if (!created) return created;
        const relationRecordId = resolveRecordId(created.id as unknown);
        if (relationRecordId !== undefined) {
          await syncBelongsToManyRelations(innerTx, belongsToManyRelations, relationRecordId, relationValues);
        }
        assignLocalRelationValues(created, belongsToManyRelations, relationValues);
        return created;
      });
    },

    async list(): Promise<Select[]> {
      let query: any = db.select().from(table as any);
      const softDeleteFilter = buildSoftDeleteFilter();
      if (softDeleteFilter) query = query.where(softDeleteFilter);
      const orderClauses = buildOrderBy(table, serviceOptions.defaultOrderBy);
      if (orderClauses.length) query = query.orderBy(...orderClauses);
      const results = (await query) as Select[];
      if (!belongsToManyRelations.length) return results;
      return hydrateBelongsToManyRelations(results, belongsToManyRelations);
    },

    async listWithDeleted(): Promise<Select[]> {
      let query: any = db.select().from(table as any);
      const orderClauses = buildOrderBy(table, serviceOptions.defaultOrderBy);
      if (orderClauses.length) query = query.orderBy(...orderClauses);
      const results = (await query) as Select[];
      if (!belongsToManyRelations.length) return results;
      return hydrateBelongsToManyRelations(results, belongsToManyRelations);
    },

    async get(id: string): Promise<Select | undefined> {
      const softDeleteFilter = buildSoftDeleteFilter();
      const whereCondition = softDeleteFilter
        ? and(eq(idColumn, id), softDeleteFilter)
        : eq(idColumn, id);
      const rows = (await db
        .select()
        .from(table as any)
        .where(whereCondition)) as Select[];
      const record = rows[0] as Select | undefined;
      if (!record || !belongsToManyRelations.length) return record;
      await hydrateBelongsToManyRelations([record], belongsToManyRelations);
      return record;
    },

    async getWithDeleted(id: string): Promise<Select | undefined> {
      const rows = (await db
        .select()
        .from(table as any)
        .where(eq(idColumn, id))) as Select[];
      const record = rows[0] as Select | undefined;
      if (!record || !belongsToManyRelations.length) return record;
      await hydrateBelongsToManyRelations([record], belongsToManyRelations);
      return record;
    },

    async update(id: string, data: Partial<Insert>, tx?: DbTransaction): Promise<Select> {
      const parsed = serviceOptions.parseUpdate
        ? await serviceOptions.parseUpdate(data)
        : data;
      const { sanitizedData, relationValues } = separateBelongsToManyInput(parsed, belongsToManyRelations);
      const updateData = {
        ...omitUndefined(sanitizedData as Record<string, any>),
      } as Partial<Insert> & Record<string, any> & { updatedAt?: Date };

      if (serviceOptions.useUpdatedAt && updateData.updatedAt === undefined) {
        updateData.updatedAt = new Date();
      }

      const shouldSyncRelations = belongsToManyRelations.length > 0 && relationValues.size > 0;

      // リレーション同期が不要な場合
      if (!shouldSyncRelations) {
        const executor = tx ?? db;
        const rows = await executor
          .update(table)
          .set(updateData as PgUpdateSetSource<TTable>)
          .where(eq(idColumn, id))
          .returning();
        return rows[0] as Select;
      }

      // リレーション同期が必要で、外部トランザクションが渡された場合
      if (tx) {
        const rows = await tx
          .update(table)
          .set(updateData as PgUpdateSetSource<TTable>)
          .where(eq(idColumn, id))
          .returning();
        const updated = rows[0] as Select;
        if (!updated) return updated;
        await syncBelongsToManyRelations(tx, belongsToManyRelations, id, relationValues);
        assignLocalRelationValues(updated, belongsToManyRelations, relationValues);
        return updated;
      }

      // リレーション同期が必要で、外部トランザクションがない場合は内部トランザクション
      return db.transaction(async (innerTx) => {
        const rows = await innerTx
          .update(table)
          .set(updateData as PgUpdateSetSource<TTable>)
          .where(eq(idColumn, id))
          .returning();
        const updated = rows[0] as Select;
        if (!updated) return updated;
        await syncBelongsToManyRelations(innerTx, belongsToManyRelations, id, relationValues);
        assignLocalRelationValues(updated, belongsToManyRelations, relationValues);
        return updated;
      });
    },

    async remove(id: string, tx?: DbTransaction): Promise<void> {
      const executor = tx ?? db;
      if (deletedAtColumn) {
        // ソフトデリート: deletedAt を現在時刻に設定
        await executor
          .update(table)
          .set({ deletedAt: new Date() } as PgUpdateSetSource<TTable>)
          .where(eq(idColumn, id));
      } else {
        // 物理削除
        await executor.delete(table).where(eq(idColumn, id));
      }
    },

    async restore(id: string, tx?: DbTransaction): Promise<Select> {
      if (!deletedAtColumn) {
        throw new Error("restore() is only available when useSoftDelete is enabled.");
      }
      const executor = tx ?? db;
      const rows = await executor
        .update(table)
        .set({ deletedAt: null } as PgUpdateSetSource<TTable>)
        .where(eq(idColumn, id))
        .returning();
      const record = rows[0] as Select;
      if (!record) {
        throw new Error(`Record not found: ${id}`);
      }
      if (belongsToManyRelations.length) {
        await hydrateBelongsToManyRelations([record], belongsToManyRelations);
      }
      return record;
    },

    async hardDelete(id: string, tx?: DbTransaction): Promise<void> {
      const executor = tx ?? db;
      await executor.delete(table).where(eq(idColumn, id));
    },

    async search(params: SearchParams = {}): Promise<PaginatedResult<Select>> {
      const {
        page = 1,
        limit = 100,
        orderBy = serviceOptions.defaultOrderBy,
        searchQuery,
        searchFields = serviceOptions.defaultSearchFields,
        where,
      } = params;

      const searchPriorityFields = params.searchPriorityFields ?? serviceOptions.defaultSearchPriorityFields;
      const prioritizeSearchHits =
        params.prioritizeSearchHits ?? serviceOptions.prioritizeSearchHitsByDefault ?? false;

      let finalWhere = buildWhere(table, where);
      // ソフトデリートフィルターを追加
      const softDeleteFilter = buildSoftDeleteFilter();
      if (softDeleteFilter) {
        finalWhere = finalWhere ? and(finalWhere, softDeleteFilter) as SQL : softDeleteFilter;
      }

      let priorityOrderClauses: SQL[] = [];
      if (searchQuery && searchFields && searchFields.length) {
        const pattern = `%${searchQuery}%`;
        const searchConds = searchFields.map((field) => ilike((table as any)[field], pattern));
        const searchWhere = or(...(searchConds as any[]));
        finalWhere = and(finalWhere, searchWhere) as SQL;

        const priorityFields = (searchPriorityFields ?? searchFields).filter((field, index, array) => {
          const exists = searchFields.includes(field);
          return exists && array.indexOf(field) === index;
        });

        priorityOrderClauses = priorityFields.map((field) => {
          const column = (table as any)[field];
          if (!column) return undefined;
          return sql`CASE WHEN ${column}::text ILIKE ${pattern} THEN 0 ELSE 1 END` as SQL;
        }).filter((clause): clause is SQL => clause !== undefined);
      }

      const baseQuery = db.select().from(table as any);
      const orderByClauses = buildOrderBy(table, orderBy);
      // セカンダリキーとしてidを追加（既にidが含まれていない場合のみ、ソート順の安定性を保証）
      const hasIdInOrderBy = orderBy?.some(([field]) => field === "id");
      if (!hasIdInOrderBy) {
        orderByClauses.push(asc(table.id));
      }
      const orderClauses = prioritizeSearchHits
        ? [...priorityOrderClauses, ...orderByClauses]
        : [...orderByClauses, ...priorityOrderClauses];
      const result = await runQuery<Select>(table, baseQuery, {
        page,
        limit,
        orderBy: orderClauses,
        where: finalWhere,
      });
      if (!belongsToManyRelations.length) return result;
      await hydrateBelongsToManyRelations(result.results, belongsToManyRelations);
      return result;
    },

    async searchWithDeleted(params: SearchParams = {}): Promise<PaginatedResult<Select>> {
      const {
        page = 1,
        limit = 100,
        orderBy = serviceOptions.defaultOrderBy,
        searchQuery,
        searchFields = serviceOptions.defaultSearchFields,
        where,
      } = params;

      const searchPriorityFields = params.searchPriorityFields ?? serviceOptions.defaultSearchPriorityFields;
      const prioritizeSearchHits =
        params.prioritizeSearchHits ?? serviceOptions.prioritizeSearchHitsByDefault ?? false;

      let finalWhere = buildWhere(table, where);
      let priorityOrderClauses: SQL[] = [];
      if (searchQuery && searchFields && searchFields.length) {
        const pattern = `%${searchQuery}%`;
        const searchConds = searchFields.map((field) => ilike((table as any)[field], pattern));
        const searchWhere = or(...(searchConds as any[]));
        finalWhere = and(finalWhere, searchWhere) as SQL;

        const priorityFields = (searchPriorityFields ?? searchFields).filter((field, index, array) => {
          const exists = searchFields.includes(field);
          return exists && array.indexOf(field) === index;
        });

        priorityOrderClauses = priorityFields.map((field) => {
          const column = (table as any)[field];
          if (!column) return undefined;
          return sql`CASE WHEN ${column}::text ILIKE ${pattern} THEN 0 ELSE 1 END` as SQL;
        }).filter((clause): clause is SQL => clause !== undefined);
      }

      const baseQuery = db.select().from(table as any);
      const orderByClauses = buildOrderBy(table, orderBy);
      // セカンダリキーとしてidを追加（既にidが含まれていない場合のみ、ソート順の安定性を保証）
      const hasIdInOrderBy = orderBy?.some(([field]) => field === "id");
      if (!hasIdInOrderBy) {
        orderByClauses.push(asc(table.id));
      }
      const orderClauses = prioritizeSearchHits
        ? [...priorityOrderClauses, ...orderByClauses]
        : [...orderByClauses, ...priorityOrderClauses];
      const result = await runQuery<Select>(table, baseQuery, {
        page,
        limit,
        orderBy: orderClauses,
        where: finalWhere,
      });
      if (!belongsToManyRelations.length) return result;
      await hydrateBelongsToManyRelations(result.results, belongsToManyRelations);
      return result;
    },

    async query<TSelect extends Record<string, any> = Select>(
      baseQuery: any,
      options: { page?: number; limit?: number; orderBy?: SQL[]; where?: SQL } = {},
      countQuery?: any,
    ): Promise<PaginatedResult<TSelect>> {
      const result = await runQuery<TSelect>(table, baseQuery, options, countQuery);
      if (!belongsToManyRelations.length) return result;
      await hydrateBelongsToManyRelations(result.results, belongsToManyRelations);
      return result;
    },

    async bulkDeleteByIds(ids: string[], tx?: DbTransaction): Promise<void> {
      const executor = tx ?? db;
      if (deletedAtColumn) {
        // ソフトデリート
        await executor
          .update(table)
          .set({ deletedAt: new Date() } as PgUpdateSetSource<TTable>)
          .where(inArray(idColumn, ids));
      } else {
        await executor.delete(table).where(inArray(idColumn, ids));
      }
    },

    async bulkDeleteByQuery(where: WhereExpr, tx?: DbTransaction): Promise<void> {
      if (!where) {
        throw new Error("bulkDeleteByQuery requires a where condition.");
      }
      const executor = tx ?? db;
      const condition = buildWhere(table, where);
      if (deletedAtColumn) {
        // ソフトデリート
        await executor
          .update(table)
          .set({ deletedAt: new Date() } as PgUpdateSetSource<TTable>)
          .where(condition);
      } else {
        await executor.delete(table).where(condition);
      }
    },

    async bulkHardDeleteByIds(ids: string[], tx?: DbTransaction): Promise<void> {
      const executor = tx ?? db;
      await executor.delete(table).where(inArray(idColumn, ids));
    },

    async upsert(
      data: Insert & { id?: string },
      upsertOptions?: UpsertOptions<Insert>,
      tx?: DbTransaction,
    ): Promise<Select> {
      const parsedInput = serviceOptions.parseUpsert
        ? await serviceOptions.parseUpsert(data)
        : serviceOptions.parseCreate
          ? await serviceOptions.parseCreate(data)
          : data;
      const { sanitizedData, relationValues } = separateBelongsToManyInput(
        parsedInput,
        belongsToManyRelations,
      );

      const sanitizedInsert = applyInsertDefaults(sanitizedData as Insert, serviceOptions) as Insert & {
        id?: string;
        createdAt?: Date;
        updatedAt?: Date;
      };

      const updateData = {
        ...sanitizedInsert,
      } as PgUpdateSetSource<TTable> & Record<string, any> & { id?: string };
      delete (updateData as Record<string, unknown>).id;

      // belongsToMany がない場合
      if (!belongsToManyRelations.length) {
        const executor = tx ?? db;
        const rows = await executor
          .insert(table)
          .values(sanitizedInsert as any)
          .onConflictDoUpdate({
            target: resolveConflictTarget(table, serviceOptions, upsertOptions),
            set: updateData,
          })
          .returning();
        return rows[0] as Select;
      }

      // belongsToMany があり、外部トランザクションが渡された場合
      if (tx) {
        const rows = await tx
          .insert(table)
          .values(sanitizedInsert as any)
          .onConflictDoUpdate({
            target: resolveConflictTarget(table, serviceOptions, upsertOptions),
            set: updateData,
          })
          .returning();
        const upserted = rows[0] as Select;
        if (!upserted) return upserted;
        const relationRecordId = resolveRecordId(upserted.id as unknown);
        if (relationRecordId !== undefined) {
          await syncBelongsToManyRelations(tx, belongsToManyRelations, relationRecordId, relationValues);
        }
        assignLocalRelationValues(upserted, belongsToManyRelations, relationValues);
        return upserted;
      }

      // belongsToMany があり、外部トランザクションがない場合は内部トランザクション
      return db.transaction(async (innerTx) => {
        const rows = await innerTx
          .insert(table)
          .values(sanitizedInsert as any)
          .onConflictDoUpdate({
            target: resolveConflictTarget(table, serviceOptions, upsertOptions),
            set: updateData,
          })
          .returning();
        const upserted = rows[0] as Select;
        if (!upserted) return upserted;
        const relationRecordId = resolveRecordId(upserted.id as unknown);
        if (relationRecordId !== undefined) {
          await syncBelongsToManyRelations(innerTx, belongsToManyRelations, relationRecordId, relationValues);
        }
        assignLocalRelationValues(upserted, belongsToManyRelations, relationValues);
        return upserted;
      });
    },

    async duplicate(id: string, tx?: DbTransaction): Promise<Select> {
      const record = await this.get(id);
      if (!record) {
        throw new Error(`Record not found: ${id}`);
      }

      const {
        id: _id,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        deletedAt: _deletedAt,
        ...rest
      } = record as Select & { id: unknown; createdAt?: unknown; updatedAt?: unknown; deletedAt?: unknown };

      const newData = rest as Record<string, unknown>;
      if (typeof newData.name === "string") {
        newData.name = `${newData.name}_コピー`;
      }

      return this.create(newData as unknown as Insert, tx);
    },
  };
}
