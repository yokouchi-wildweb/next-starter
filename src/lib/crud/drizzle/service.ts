// src/lib/crud/drizzle/service.ts

import { db } from "@/lib/drizzle";
import { omitUndefined } from "@/utils/object";
import { eq, inArray, SQL, ilike, and, or, sql, isNull, asc, getTableName, gt } from "drizzle-orm";
import { generateSortKey, generateFirstSortKey } from "./fractionalSort";
import { DomainError } from "@/lib/errors";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { PgTable, AnyPgColumn, PgUpdateSetSource, PgTimestampString } from "drizzle-orm/pg-core";
import type {
  SearchParams,
  PaginatedResult,
  UpsertOptions,
  BulkUpsertOptions,
  BulkUpsertResult,
  WhereExpr,
  WithOptions,
} from "../types";
import { buildOrderBy, buildWhere, runQuery } from "./query";
import { applyInsertDefaults, resolveConflictTarget } from "./utils";
import type { DrizzleCrudServiceOptions, DbTransaction } from "./types";
import {
  assignLocalRelationValues,
  hydrateBelongsToManyRelations,
  separateBelongsToManyInput,
  syncBelongsToManyRelations,
} from "./belongsToMany";
import { hydrateBelongsTo, hydrateBelongsToManyObjects, hydrateCount } from "./relations";

const resolveRecordId = (value: unknown): string | number | undefined => {
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  return undefined;
};

/**
 * エラーオブジェクトからPostgreSQLエラーコードを抽出する
 * Drizzleはエラーをラップするため、直接またはcause経由で確認
 */
export const extractPgErrorCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object") return undefined;

  // 直接codeを持つ場合
  if ("code" in error && typeof error.code === "string") {
    return error.code;
  }

  // cause経由でcodeを持つ場合（Drizzleのラップ）
  if ("cause" in error && error.cause && typeof error.cause === "object") {
    const cause = error.cause as Record<string, unknown>;
    if ("code" in cause && typeof cause.code === "string") {
      return cause.code;
    }
  }

  return undefined;
};

/**
 * ユニーク制約違反かどうかを判定する
 */
export const isPgUniqueViolation = (error: unknown): boolean => {
  return extractPgErrorCode(error) === "23505";
};

/**
 * 制約違反エラーを検出してDomainErrorに変換する
 * PostgreSQL エラーコード:
 * - 23503 = foreign_key_violation（RESTRICT違反）
 * - 23502 = not_null_violation（SET_NULL + NOT NULL制約違反）
 * - 23505 = unique_violation（ユニーク制約違反）
 */
export const handleConstraintError = (error: unknown): never => {
  const pgCode = extractPgErrorCode(error);
  if (pgCode === "23503") {
    throw new DomainError(
      "このレコードは他のデータから参照されているため削除できません",
      { status: 409 }
    );
  }
  if (pgCode === "23502") {
    throw new DomainError(
      "削除するには関連レコードで空の値を許容する必要があります",
      { status: 409 }
    );
  }
  if (pgCode === "23505") {
    throw new DomainError("この値は既に使用されています", { status: 409 });
  }
  throw error;
};

/**
 * CRUDミドルウェアの型定義
 * 各ミドルウェアは関数をラップして共通処理を追加する
 */
type CrudMiddleware = <T>(fn: () => Promise<T>) => Promise<T>;

/**
 * 制約エラーハンドリングミドルウェア
 * PostgreSQLの制約違反エラーをDomainErrorに変換する
 */
const withConstraintHandling: CrudMiddleware = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    // handleConstraintErrorは常にthrowするため、ここには到達しない
    throw handleConstraintError(error);
  }
};

/**
 * CRUDミドルウェア配列
 * 新しいミドルウェアはここに追加する
 */
const crudMiddlewares: CrudMiddleware[] = [
  withConstraintHandling,
  // 将来追加: withLogging, withRetry, etc.
];

/**
 * 全CRUDミドルウェアを適用するラッパー
 * create/update/upsert等の操作で使用する
 */
const withCrudEnhancements = <T>(fn: () => Promise<T>): Promise<T> => {
  return crudMiddlewares.reduce<() => Promise<T>>(
    (wrapped, middleware) => () => middleware(wrapped),
    fn
  )();
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

  // withRelations / withCount 用のリレーション設定
  const belongsToRelations = serviceOptions.belongsToRelations ?? [];
  const belongsToManyObjectRelations = serviceOptions.belongsToManyObjectRelations ?? [];
  const countableRelations = serviceOptions.countableRelations ?? [];
  // reorder 用の sortOrder カラム
  const sortOrderColumn = serviceOptions.sortOrderColumn;
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
      return withCrudEnhancements(async () => {
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
      });
    },

    async list(options?: WithOptions): Promise<Select[]> {
      let query: any = db.select().from(table as any);
      const softDeleteFilter = buildSoftDeleteFilter();
      if (softDeleteFilter) query = query.where(softDeleteFilter);
      const orderClauses = buildOrderBy(table, serviceOptions.defaultOrderBy);
      if (orderClauses.length) query = query.orderBy(...orderClauses);
      const results = (await query) as Select[];

      // 既存の belongsToMany ID配列の hydrate
      if (belongsToManyRelations.length) {
        await hydrateBelongsToManyRelations(results, belongsToManyRelations);
      }

      // withRelations: リレーション先オブジェクトを展開
      if (options?.withRelations) {
        if (belongsToRelations.length) {
          await hydrateBelongsTo(results, belongsToRelations);
        }
        if (belongsToManyObjectRelations.length) {
          await hydrateBelongsToManyObjects(results, belongsToManyObjectRelations);
        }
      }

      // withCount: リレーション先のレコード数を取得
      if (options?.withCount) {
        if (countableRelations.length) {
          await hydrateCount(results, countableRelations);
        }
      }

      return results;
    },

    async listWithDeleted(options?: WithOptions): Promise<Select[]> {
      let query: any = db.select().from(table as any);
      const orderClauses = buildOrderBy(table, serviceOptions.defaultOrderBy);
      if (orderClauses.length) query = query.orderBy(...orderClauses);
      const results = (await query) as Select[];

      // 既存の belongsToMany ID配列の hydrate
      if (belongsToManyRelations.length) {
        await hydrateBelongsToManyRelations(results, belongsToManyRelations);
      }

      // withRelations: リレーション先オブジェクトを展開
      if (options?.withRelations) {
        if (belongsToRelations.length) {
          await hydrateBelongsTo(results, belongsToRelations);
        }
        if (belongsToManyObjectRelations.length) {
          await hydrateBelongsToManyObjects(results, belongsToManyObjectRelations);
        }
      }

      // withCount: リレーション先のレコード数を取得
      if (options?.withCount) {
        if (countableRelations.length) {
          await hydrateCount(results, countableRelations);
        }
      }

      return results;
    },

    async get(id: string, options?: WithOptions): Promise<Select | undefined> {
      const softDeleteFilter = buildSoftDeleteFilter();
      const whereCondition = softDeleteFilter
        ? and(eq(idColumn, id), softDeleteFilter)
        : eq(idColumn, id);
      const rows = (await db
        .select()
        .from(table as any)
        .where(whereCondition)) as Select[];
      const record = rows[0] as Select | undefined;
      if (!record) return record;

      // 既存の belongsToMany ID配列の hydrate
      if (belongsToManyRelations.length) {
        await hydrateBelongsToManyRelations([record], belongsToManyRelations);
      }

      // withRelations: リレーション先オブジェクトを展開
      if (options?.withRelations) {
        if (belongsToRelations.length) {
          await hydrateBelongsTo([record], belongsToRelations);
        }
        if (belongsToManyObjectRelations.length) {
          await hydrateBelongsToManyObjects([record], belongsToManyObjectRelations);
        }
      }

      // withCount: リレーション先のレコード数を取得
      if (options?.withCount) {
        if (countableRelations.length) {
          await hydrateCount([record], countableRelations);
        }
      }

      return record;
    },

    async getWithDeleted(id: string, options?: WithOptions): Promise<Select | undefined> {
      const rows = (await db
        .select()
        .from(table as any)
        .where(eq(idColumn, id))) as Select[];
      const record = rows[0] as Select | undefined;
      if (!record) return record;

      // 既存の belongsToMany ID配列の hydrate
      if (belongsToManyRelations.length) {
        await hydrateBelongsToManyRelations([record], belongsToManyRelations);
      }

      // withRelations: リレーション先オブジェクトを展開
      if (options?.withRelations) {
        if (belongsToRelations.length) {
          await hydrateBelongsTo([record], belongsToRelations);
        }
        if (belongsToManyObjectRelations.length) {
          await hydrateBelongsToManyObjects([record], belongsToManyObjectRelations);
        }
      }

      // withCount: リレーション先のレコード数を取得
      if (options?.withCount) {
        if (countableRelations.length) {
          await hydrateCount([record], countableRelations);
        }
      }

      return record;
    },

    async update(id: string, data: Partial<Insert>, tx?: DbTransaction): Promise<Select> {
      return withCrudEnhancements(async () => {
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
        try {
          await executor.delete(table).where(eq(idColumn, id));
        } catch (error) {
          handleConstraintError(error);
        }
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
      try {
        await executor.delete(table).where(eq(idColumn, id));
      } catch (error) {
        handleConstraintError(error);
      }
    },

    async search(params: SearchParams & WithOptions = {}): Promise<PaginatedResult<Select>> {
      const {
        page = 1,
        limit = 100,
        orderBy = serviceOptions.defaultOrderBy,
        searchQuery,
        searchFields = serviceOptions.defaultSearchFields,
        where,
        withRelations,
        withCount,
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

      // 既存の belongsToMany ID配列の hydrate
      if (belongsToManyRelations.length) {
        await hydrateBelongsToManyRelations(result.results, belongsToManyRelations);
      }

      // withRelations: リレーション先オブジェクトを展開
      if (withRelations) {
        if (belongsToRelations.length) {
          await hydrateBelongsTo(result.results, belongsToRelations);
        }
        if (belongsToManyObjectRelations.length) {
          await hydrateBelongsToManyObjects(result.results, belongsToManyObjectRelations);
        }
      }

      // withCount: リレーション先のレコード数を取得
      if (withCount) {
        if (countableRelations.length) {
          await hydrateCount(result.results, countableRelations);
        }
      }

      return result;
    },

    async searchWithDeleted(params: SearchParams & WithOptions = {}): Promise<PaginatedResult<Select>> {
      const {
        page = 1,
        limit = 100,
        orderBy = serviceOptions.defaultOrderBy,
        searchQuery,
        searchFields = serviceOptions.defaultSearchFields,
        where,
        withRelations,
        withCount,
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

      // 既存の belongsToMany ID配列の hydrate
      if (belongsToManyRelations.length) {
        await hydrateBelongsToManyRelations(result.results, belongsToManyRelations);
      }

      // withRelations: リレーション先オブジェクトを展開
      if (withRelations) {
        if (belongsToRelations.length) {
          await hydrateBelongsTo(result.results, belongsToRelations);
        }
        if (belongsToManyObjectRelations.length) {
          await hydrateBelongsToManyObjects(result.results, belongsToManyObjectRelations);
        }
      }

      // withCount: リレーション先のレコード数を取得
      if (withCount) {
        if (countableRelations.length) {
          await hydrateCount(result.results, countableRelations);
        }
      }

      return result;
    },

    async query<TSelect extends Record<string, any> = Select>(
      baseQuery: any,
      options: { page?: number; limit?: number; orderBy?: SQL[]; where?: SQL } & WithOptions = {},
      countQuery?: any,
    ): Promise<PaginatedResult<TSelect>> {
      const { withRelations, withCount, ...queryOptions } = options;
      const result = await runQuery<TSelect>(table, baseQuery, queryOptions, countQuery);

      // 既存の belongsToMany ID配列の hydrate
      if (belongsToManyRelations.length) {
        await hydrateBelongsToManyRelations(result.results, belongsToManyRelations);
      }

      // withRelations: リレーション先オブジェクトを展開
      if (withRelations) {
        if (belongsToRelations.length) {
          await hydrateBelongsTo(result.results, belongsToRelations);
        }
        if (belongsToManyObjectRelations.length) {
          await hydrateBelongsToManyObjects(result.results, belongsToManyObjectRelations);
        }
      }

      // withCount: リレーション先のレコード数を取得
      if (withCount) {
        if (countableRelations.length) {
          await hydrateCount(result.results, countableRelations);
        }
      }

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
        try {
          await executor.delete(table).where(inArray(idColumn, ids));
        } catch (error) {
          handleConstraintError(error);
        }
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
        try {
          await executor.delete(table).where(condition);
        } catch (error) {
          handleConstraintError(error);
        }
      }
    },

    async bulkHardDeleteByIds(ids: string[], tx?: DbTransaction): Promise<void> {
      const executor = tx ?? db;
      try {
        await executor.delete(table).where(inArray(idColumn, ids));
      } catch (error) {
        handleConstraintError(error);
      }
    },

    async upsert(
      data: Insert & { id?: string },
      upsertOptions?: UpsertOptions<Insert>,
      tx?: DbTransaction,
    ): Promise<Select> {
      return withCrudEnhancements(async () => {
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
      });
    },

    /**
     * 複数レコードを一括でupsertする。
     * belongsToMany リレーションには対応していない。
     */
    async bulkUpsert(
      records: (Insert & { id?: string })[],
      bulkUpsertOptions?: BulkUpsertOptions<Insert>,
      tx?: DbTransaction,
    ): Promise<BulkUpsertResult<Select>> {
      if (records.length === 0) {
        return { results: [], count: 0 };
      }

      // belongsToMany がある場合は警告（対応していない）
      if (belongsToManyRelations.length > 0) {
        console.warn(
          "bulkUpsert does not support belongsToMany relations. Use upsert() individually for relation sync.",
        );
      }

      return withCrudEnhancements(async () => {
        // 各レコードをパースしてデフォルト値を適用
        const parsedRecords = await Promise.all(
          records.map(async (data) => {
            // parse 前に id を保存（parse で削除される可能性があるため）
            const originalId = data.id;
            const parsedInput = serviceOptions.parseUpsert
              ? await serviceOptions.parseUpsert(data)
              : serviceOptions.parseCreate
                ? await serviceOptions.parseCreate(data)
                : data;
            // parse 後に id を復元
            const withId = originalId !== undefined
              ? { ...parsedInput, id: originalId }
              : parsedInput;
            return applyInsertDefaults(withId as Insert, serviceOptions) as Insert & {
              id?: string;
              createdAt?: Date;
              updatedAt?: Date;
            };
          }),
        );

        // 更新用のデータを構築（idを除外）
        const firstRecord = parsedRecords[0];
        const updateColumns = Object.keys(firstRecord).filter((key) => key !== "id") as Array<
          keyof typeof firstRecord
        >;
        const updateData = Object.fromEntries(
          updateColumns.map((col) => {
            // テーブル定義からカラム情報を取得し、実際のカラム名（snake_case）を使用
            const column = (table as any)[col];
            const columnName = column?.name ?? String(col);
            return [col, sql.raw(`excluded."${columnName}"`)];
          }),
        ) as PgUpdateSetSource<TTable>;

        const executor = tx ?? db;
        const conflictTarget = resolveConflictTarget(table, serviceOptions, bulkUpsertOptions);

        let rows: Select[];
        if (bulkUpsertOptions?.skipDuplicates) {
          // 重複時はスキップ（更新しない）
          rows = (await executor
            .insert(table)
            .values(parsedRecords as any[])
            .onConflictDoNothing({ target: conflictTarget })
            .returning()) as Select[];
        } else {
          // 重複時は更新
          rows = (await executor
            .insert(table)
            .values(parsedRecords as any[])
            .onConflictDoUpdate({
              target: conflictTarget,
              set: updateData,
            })
            .returning()) as Select[];
        }

        return { results: rows, count: rows.length };
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

    /**
     * テーブルの全データを物理削除する（TRUNCATE CASCADE）
     * belongsToMany中間テーブルも削除対象となる
     *
     * @returns 削除されたテーブル名の配列（メインテーブル + 中間テーブル）
     */
    async truncateAll(): Promise<string[]> {
      const truncatedTables: string[] = [];
      const mainTableName = getTableName(table);

      // belongsToMany中間テーブルを先に削除
      for (const relation of belongsToManyRelations) {
        const throughTableName = getTableName(relation.throughTable);
        await db.execute(sql.raw(`TRUNCATE TABLE "${throughTableName}" CASCADE`));
        truncatedTables.push(throughTableName);
      }

      // メインテーブルをTRUNCATE
      await db.execute(sql.raw(`TRUNCATE TABLE "${mainTableName}" CASCADE`));
      truncatedTables.push(mainTableName);

      return truncatedTables;
    },

    /**
     * TRUNCATE CASCADE実行時に影響を受けるテーブル一覧を取得する
     * （実際の削除は行わない）
     *
     * @returns 影響を受けるテーブル名の配列
     */
    async getTruncateAffectedTables(): Promise<string[]> {
      const mainTableName = getTableName(table);

      // PostgreSQLのシステムカタログから外部キー参照を取得
      const result = await db.execute(sql`
        SELECT DISTINCT
          tc.table_name as referencing_table
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
          AND tc.table_schema = ccu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = ${mainTableName}
          AND tc.table_schema = 'public'
      `) as { referencing_table: string }[];

      const affectedTables: string[] = [mainTableName];

      // belongsToMany中間テーブルを追加
      for (const relation of belongsToManyRelations) {
        const throughTableName = getTableName(relation.throughTable);
        if (!affectedTables.includes(throughTableName)) {
          affectedTables.push(throughTableName);
        }
      }

      // 外部キーで参照しているテーブルを追加
      for (const row of result) {
        if (!affectedTables.includes(row.referencing_table)) {
          affectedTables.push(row.referencing_table);
        }
      }

      return affectedTables;
    },

    /**
     * テーブル名を取得する
     */
    getTableName(): string {
      return getTableName(table);
    },

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
          .orderBy(asc(sortOrderColumn))
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
            .where(gt(sortOrderColumn, afterSortOrder))
            .orderBy(asc(sortOrderColumn))
            .limit(1) as { sortOrder: string | null }[];

          const nextSortOrder = nextResults[0]?.sortOrder ?? null;
          newSortOrder = generateSortKey(afterSortOrder, nextSortOrder);
        }
      }

      // sortOrder を更新
      const updateData = { sortOrder: newSortOrder } as Record<string, any>;
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
  };
}
