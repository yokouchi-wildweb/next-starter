// src/lib/crud/drizzle/service.ts

import { db } from "@/lib/drizzle";
import { omitUndefined } from "@/utils/object";
import { eq, inArray, SQL, ilike, and, or, sql, isNull, asc, desc, getTableName, gt } from "drizzle-orm";
import { generateSortKey, generateFirstSortKey, generateLastSortKey, generateLastSortKeys } from "./fractionalSort";
import { DomainError } from "@/lib/errors";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { PgTable, AnyPgColumn, PgUpdateSetSource, PgTimestampString } from "drizzle-orm/pg-core";
import type {
  SearchParams,
  PaginatedResult,
  UpsertOptions,
  BulkUpsertOptions,
  BulkUpsertResult,
  BulkUpdateRecord,
  BulkUpdateResult,
  WhereExpr,
  WithOptions,
} from "../types";
import { buildOrderBy, buildWhere, runQuery } from "./query";
import { applyInsertDefaults, normalizeRecordKeys, resolveConflictTarget } from "./utils";
import type { DrizzleCrudServiceOptions, DbTransaction, ExtraWhereOption } from "./types";
import {
  assignLocalRelationValues,
  hydrateBelongsToManyRelations,
  separateBelongsToManyInput,
  syncBelongsToManyRelations,
  bulkSyncBelongsToManyRelations,
} from "./belongsToMany";
import { hydrateBelongsTo, hydrateBelongsToManyObjects, hydrateCount } from "./relations";

const resolveRecordId = (value: unknown): string | number | undefined => {
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  return undefined;
};

/**
 * withRelations オプションから展開する深さを解決する。
 * - false/undefined: 0（展開しない）
 * - true/1: 1階層
 * - 2: 2階層（リレーション先のリレーションも展開）
 */
const resolveRelationDepth = (withRelations?: boolean | number): number => {
  if (withRelations === true) return 1;
  if (typeof withRelations === "number" && withRelations > 0) return withRelations;
  return 0;
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
 * CRUD操作タイプ
 */
type CrudOperationType = "write" | "delete";

/**
 * 制約違反エラーを検出してDomainErrorに変換する
 * PostgreSQL エラーコード:
 * - 23503 = foreign_key_violation（RESTRICT違反）
 * - 23502 = not_null_violation（SET_NULL + NOT NULL制約違反）
 * - 23505 = unique_violation（ユニーク制約違反）
 *
 * @param error - キャッチしたエラー
 * @param operationType - 操作タイプ（write: INSERT/UPDATE, delete: DELETE）
 */
export const handleConstraintError = (
  error: unknown,
  operationType: CrudOperationType = "delete"
): never => {
  const pgCode = extractPgErrorCode(error);
  if (pgCode === "23503") {
    // 外部キー制約違反は操作タイプによってメッセージを分ける
    if (operationType === "write") {
      throw new DomainError(
        "参照先のレコードが存在しません",
        { status: 409 }
      );
    } else {
      throw new DomainError(
        "このレコードは他のデータから参照されているため削除できません",
        { status: 409 }
      );
    }
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
type CrudMiddleware = <T>(fn: () => Promise<T>, operationType: CrudOperationType) => Promise<T>;

/**
 * 制約エラーハンドリングミドルウェア
 * PostgreSQLの制約違反エラーをDomainErrorに変換する
 */
const withConstraintHandling: CrudMiddleware = async <T>(
  fn: () => Promise<T>,
  operationType: CrudOperationType
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    // handleConstraintErrorは常にthrowするため、ここには到達しない
    throw handleConstraintError(error, operationType);
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
 * create/update/upsert等の書き込み操作で使用する
 */
const withCrudEnhancements = <T>(fn: () => Promise<T>): Promise<T> => {
  return crudMiddlewares.reduce<() => Promise<T>>(
    (wrapped, middleware) => () => middleware(wrapped, "write"),
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
        let finalInsert = applyInsertDefaults(sanitizedData as Insert, serviceOptions) as Insert;

        // sortOrderColumn が設定されている場合、sort_order を自動生成（先頭に追加）
        if (sortOrderColumn) {
          const sortOrderFieldName = (sortOrderColumn as any).name as string;
          if ((finalInsert as Record<string, any>)[sortOrderFieldName] === undefined) {
            const executor = tx ?? db;
            // 現在の最小 sortOrder を取得
            const firstResults = await executor
              .select({ sortOrder: sortOrderColumn })
              .from(table as any)
              .orderBy(asc(sortOrderColumn))
              .limit(1) as { sortOrder: string | null }[];
            const firstSortOrder = firstResults[0]?.sortOrder ?? null;
            (finalInsert as Record<string, any>)[sortOrderFieldName] = generateFirstSortKey(firstSortOrder);
          }
        }

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
      const limit = options?.limit ?? 100;
      let query: any = db.select().from(table as any);
      const softDeleteFilter = buildSoftDeleteFilter();
      if (softDeleteFilter) query = query.where(softDeleteFilter);
      const orderClauses = buildOrderBy(table, serviceOptions.defaultOrderBy);
      if (orderClauses.length) query = query.orderBy(...orderClauses);
      query = query.limit(limit);
      const results = (await query) as Select[];

      // 既存の belongsToMany ID配列の hydrate
      if (belongsToManyRelations.length) {
        await hydrateBelongsToManyRelations(results, belongsToManyRelations);
      }

      // withRelations: リレーション先オブジェクトを展開
      const depth = resolveRelationDepth(options?.withRelations);
      if (depth > 0) {
        // belongsToMany展開関数をラップ（再帰呼び出し用）
        const wrappedHydrateBelongsToMany = async (
          recs: Record<string, any>[],
          rels: typeof belongsToManyObjectRelations,
          d: number,
        ) => {
          await hydrateBelongsToManyObjects(recs, rels, d, hydrateBelongsTo);
        };

        if (belongsToRelations.length) {
          await hydrateBelongsTo(results, belongsToRelations, depth, wrappedHydrateBelongsToMany);
        }
        if (belongsToManyObjectRelations.length) {
          await hydrateBelongsToManyObjects(results, belongsToManyObjectRelations, depth, hydrateBelongsTo);
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
      const depth = resolveRelationDepth(options?.withRelations);
      if (depth > 0) {
        const wrappedHydrateBelongsToMany = async (
          recs: Record<string, any>[],
          rels: typeof belongsToManyObjectRelations,
          d: number,
        ) => {
          await hydrateBelongsToManyObjects(recs, rels, d, hydrateBelongsTo);
        };

        if (belongsToRelations.length) {
          await hydrateBelongsTo(results, belongsToRelations, depth, wrappedHydrateBelongsToMany);
        }
        if (belongsToManyObjectRelations.length) {
          await hydrateBelongsToManyObjects(results, belongsToManyObjectRelations, depth, hydrateBelongsTo);
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
      const depth = resolveRelationDepth(options?.withRelations);
      if (depth > 0) {
        const wrappedHydrateBelongsToMany = async (
          recs: Record<string, any>[],
          rels: typeof belongsToManyObjectRelations,
          d: number,
        ) => {
          await hydrateBelongsToManyObjects(recs, rels, d, hydrateBelongsTo);
        };

        if (belongsToRelations.length) {
          await hydrateBelongsTo([record], belongsToRelations, depth, wrappedHydrateBelongsToMany);
        }
        if (belongsToManyObjectRelations.length) {
          await hydrateBelongsToManyObjects([record], belongsToManyObjectRelations, depth, hydrateBelongsTo);
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
      const depthWithDeleted = resolveRelationDepth(options?.withRelations);
      if (depthWithDeleted > 0) {
        const wrappedHydrateBelongsToMany = async (
          recs: Record<string, any>[],
          rels: typeof belongsToManyObjectRelations,
          d: number,
        ) => {
          await hydrateBelongsToManyObjects(recs, rels, d, hydrateBelongsTo);
        };

        if (belongsToRelations.length) {
          await hydrateBelongsTo([record], belongsToRelations, depthWithDeleted, wrappedHydrateBelongsToMany);
        }
        if (belongsToManyObjectRelations.length) {
          await hydrateBelongsToManyObjects([record], belongsToManyObjectRelations, depthWithDeleted, hydrateBelongsTo);
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
        const hasColumnUpdates = Object.keys(updateData).length > 0;

        // カラム更新またはリレーション同期のいずれかを実行するヘルパー
        const updateOrSelect = async (executor: DbTransaction | typeof db): Promise<Select> => {
          if (hasColumnUpdates) {
            const rows = await executor
              .update(table)
              .set(updateData as PgUpdateSetSource<TTable>)
              .where(eq(idColumn, id))
              .returning();
            return rows[0] as Select;
          }
          // belongsToMany のみの場合、既存レコードを取得
          const rows = await executor
            .select()
            .from(table as any)
            .where(eq(idColumn, id));
          return rows[0] as Select;
        };

        // リレーション同期が不要な場合
        if (!shouldSyncRelations) {
          const executor = tx ?? db;
          return updateOrSelect(executor);
        }

        // リレーション同期が必要で、外部トランザクションが渡された場合
        if (tx) {
          const updated = await updateOrSelect(tx);
          if (!updated) return updated;
          await syncBelongsToManyRelations(tx, belongsToManyRelations, id, relationValues);
          assignLocalRelationValues(updated, belongsToManyRelations, relationValues);
          return updated;
        }

        // リレーション同期が必要で、外部トランザクションがない場合は内部トランザクション
        return db.transaction(async (innerTx) => {
          const updated = await updateOrSelect(innerTx);
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

    async search(params: SearchParams & WithOptions & ExtraWhereOption = {}): Promise<PaginatedResult<Select>> {
      const {
        page = 1,
        limit = 100,
        orderBy = serviceOptions.defaultOrderBy,
        searchQuery,
        searchFields = serviceOptions.defaultSearchFields,
        where,
        extraWhere,
        withRelations,
        withCount,
      } = params;

      const searchPriorityFields = params.searchPriorityFields ?? serviceOptions.defaultSearchPriorityFields;
      const prioritizeSearchHits =
        params.prioritizeSearchHits ?? serviceOptions.prioritizeSearchHitsByDefault ?? false;

      let finalWhere = buildWhere(table, where);
      // extraWhere（Drizzle SQL条件）を合成
      if (extraWhere) {
        finalWhere = and(finalWhere, extraWhere) as SQL;
      }
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
      const depth = resolveRelationDepth(withRelations);
      if (depth > 0) {
        const wrappedHydrateBelongsToMany = async (
          recs: Record<string, any>[],
          rels: typeof belongsToManyObjectRelations,
          d: number,
        ) => {
          await hydrateBelongsToManyObjects(recs, rels, d, hydrateBelongsTo);
        };

        if (belongsToRelations.length) {
          await hydrateBelongsTo(result.results, belongsToRelations, depth, wrappedHydrateBelongsToMany);
        }
        if (belongsToManyObjectRelations.length) {
          await hydrateBelongsToManyObjects(result.results, belongsToManyObjectRelations, depth, hydrateBelongsTo);
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

    async searchWithDeleted(params: SearchParams & WithOptions & ExtraWhereOption = {}): Promise<PaginatedResult<Select>> {
      const {
        page = 1,
        limit = 100,
        orderBy = serviceOptions.defaultOrderBy,
        searchQuery,
        searchFields = serviceOptions.defaultSearchFields,
        where,
        extraWhere,
        withRelations,
        withCount,
      } = params;

      const searchPriorityFields = params.searchPriorityFields ?? serviceOptions.defaultSearchPriorityFields;
      const prioritizeSearchHits =
        params.prioritizeSearchHits ?? serviceOptions.prioritizeSearchHitsByDefault ?? false;

      let finalWhere = buildWhere(table, where);
      // extraWhere（Drizzle SQL条件）を合成
      if (extraWhere) {
        finalWhere = and(finalWhere, extraWhere) as SQL;
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
      const depthSearchWithDeleted = resolveRelationDepth(withRelations);
      if (depthSearchWithDeleted > 0) {
        const wrappedHydrateBelongsToMany = async (
          recs: Record<string, any>[],
          rels: typeof belongsToManyObjectRelations,
          d: number,
        ) => {
          await hydrateBelongsToManyObjects(recs, rels, d, hydrateBelongsTo);
        };

        if (belongsToRelations.length) {
          await hydrateBelongsTo(result.results, belongsToRelations, depthSearchWithDeleted, wrappedHydrateBelongsToMany);
        }
        if (belongsToManyObjectRelations.length) {
          await hydrateBelongsToManyObjects(result.results, belongsToManyObjectRelations, depthSearchWithDeleted, hydrateBelongsTo);
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
      const depthQuery = resolveRelationDepth(withRelations);
      if (depthQuery > 0) {
        const wrappedHydrateBelongsToMany = async (
          recs: Record<string, any>[],
          rels: typeof belongsToManyObjectRelations,
          d: number,
        ) => {
          await hydrateBelongsToManyObjects(recs, rels, d, hydrateBelongsTo);
        };

        if (belongsToRelations.length) {
          await hydrateBelongsTo(result.results, belongsToRelations, depthQuery, wrappedHydrateBelongsToMany);
        }
        if (belongsToManyObjectRelations.length) {
          await hydrateBelongsToManyObjects(result.results, belongsToManyObjectRelations, depthQuery, hydrateBelongsTo);
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

    async bulkUpdateByIds(
      ids: string[],
      data: Partial<Insert>,
      tx?: DbTransaction,
    ): Promise<{ count: number }> {
      if (ids.length === 0) {
        return { count: 0 };
      }

      const parsed = serviceOptions.parseUpdate
        ? await serviceOptions.parseUpdate(data)
        : data;
      const { sanitizedData, relationValues } = separateBelongsToManyInput(parsed, belongsToManyRelations);
      const updateData = omitUndefined({
        ...sanitizedData,
        ...(serviceOptions.useUpdatedAt && { updatedAt: new Date() }),
      }) as PgUpdateSetSource<TTable>;

      const hasColumnUpdates = Object.keys(updateData).length > 0;
      const shouldSyncRelations = belongsToManyRelations.length > 0 && relationValues.size > 0;

      // リレーション同期が不要な場合: 1クエリで完了
      if (!shouldSyncRelations) {
        const executor = tx ?? db;
        if (hasColumnUpdates) {
          await executor
            .update(table)
            .set(updateData)
            .where(inArray(idColumn, ids));
          return { count: ids.length };
        }
        return { count: 0 };
      }

      // リレーション同期が必要な場合: カラム更新は1クエリ、リレーション同期は各IDごと
      const performUpdate = async (executor: DbTransaction | typeof db): Promise<{ count: number }> => {
        if (hasColumnUpdates) {
          await executor
            .update(table)
            .set(updateData)
            .where(inArray(idColumn, ids));
        }
        await bulkSyncBelongsToManyRelations(
          executor as DbTransaction,
          belongsToManyRelations,
          ids,
          relationValues,
        );
        return { count: ids.length };
      };

      if (tx) {
        return performUpdate(tx);
      }
      return db.transaction(async (innerTx) => performUpdate(innerTx));
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
            // キー名を drizzle スキーマのプロパティ名に正規化（snake_case → camelCase など）
            const normalizedData = normalizeRecordKeys(table, data as Record<string, unknown>) as typeof data;

            // parse 前にシステムフィールドを保存（parse で削除される可能性があるため）
            // Zod スキーマに定義されていないフィールドは strip される
            const originalId = normalizedData.id;
            const originalCreatedAt = (normalizedData as any).createdAt;
            const originalUpdatedAt = (normalizedData as any).updatedAt;
            const originalDeletedAt = (normalizedData as any).deletedAt;

            const parsedInput = serviceOptions.parseUpsert
              ? await serviceOptions.parseUpsert(normalizedData)
              : serviceOptions.parseCreate
                ? await serviceOptions.parseCreate(normalizedData)
                : normalizedData;

            // parse 後にシステムフィールドを復元
            const restored = { ...parsedInput } as any;
            if (originalId !== undefined) {
              restored.id = originalId;
            }
            // createdAt/updatedAt/deletedAt は明示的に設定されていた場合のみ復元
            // これにより CSV からインポートした値が applyInsertDefaults で上書きされない
            // 文字列の場合は Date オブジェクトに変換（drizzle が toISOString を呼ぶため）
            if (originalCreatedAt !== undefined) {
              restored.createdAt = typeof originalCreatedAt === "string"
                ? new Date(originalCreatedAt)
                : originalCreatedAt;
            }
            if (originalUpdatedAt !== undefined) {
              restored.updatedAt = typeof originalUpdatedAt === "string"
                ? new Date(originalUpdatedAt)
                : originalUpdatedAt;
            }
            if (originalDeletedAt !== undefined) {
              restored.deletedAt = typeof originalDeletedAt === "string"
                ? new Date(originalDeletedAt)
                : originalDeletedAt;
            }
            return applyInsertDefaults(restored as Insert, serviceOptions) as Insert & {
              id?: string;
              createdAt?: Date;
              updatedAt?: Date;
            };
          }),
        );

        // 更新用のデータを構築（idを除外、excludeFromUpdate も除外）
        const firstRecord = parsedRecords[0];
        const excludeSet = new Set(bulkUpsertOptions?.excludeFromUpdate ?? []);
        const updateColumns = Object.keys(firstRecord).filter(
          (key) => key !== "id" && !excludeSet.has(key)
        ) as Array<keyof typeof firstRecord>;
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

    /**
     * 複数レコードを一括で更新する。
     * 存在しないIDはスキップされ、notFoundIdsに含まれる。
     */
    async bulkUpdate(
      records: BulkUpdateRecord<Partial<Insert>>[],
      tx?: DbTransaction,
    ): Promise<BulkUpdateResult<Select>> {
      if (records.length === 0) {
        return { results: [], count: 0, notFoundIds: [] };
      }

      const ids = records.map((r) => r.id);
      const hasBelongsToMany = belongsToManyRelations.length > 0;

      const performBulkUpdate = async (executor: DbTransaction | typeof db): Promise<BulkUpdateResult<Select>> => {
        // 存在するレコードを確認
        const existingRows = await executor
          .select({ id: idColumn })
          .from(table as any)
          .where(inArray(idColumn, ids)) as unknown as { id: string }[];
        const existingIds = new Set(existingRows.map((r) => r.id));
        const notFoundIds = ids.filter((id) => !existingIds.has(id));

        const validRecords = records.filter((r) => existingIds.has(r.id));
        if (validRecords.length === 0) {
          return { results: [], count: 0, notFoundIds };
        }

        // 全レコードのパース・分離を先に実行
        const parsed = await Promise.all(
          validRecords.map(async (record) => {
            const parsedInput = serviceOptions.parseUpdate
              ? await serviceOptions.parseUpdate(record.data)
              : record.data;
            const { sanitizedData, relationValues } = separateBelongsToManyInput(
              parsedInput,
              belongsToManyRelations,
            );
            const updateData = omitUndefined({
              ...sanitizedData,
              ...(serviceOptions.useUpdatedAt && { updatedAt: new Date() }),
            }) as Record<string, any>;
            return { id: record.id, updateData, relationValues };
          }),
        );

        // カラム更新があるレコードを抽出
        const recordsWithColumnUpdates = parsed.filter(
          (p) => Object.keys(p.updateData).length > 0,
        );

        // CASE WHEN 方式で1クエリにまとめてUPDATE
        if (recordsWithColumnUpdates.length > 0) {
          // 更新対象カラム名を収集（全レコード横断）
          const allColumns = new Set<string>();
          for (const p of recordsWithColumnUpdates) {
            for (const key of Object.keys(p.updateData)) {
              allColumns.add(key);
            }
          }

          const bulkIds = recordsWithColumnUpdates.map((p) => p.id);
          const setClause: Record<string, any> = {};

          for (const col of allColumns) {
            // 全レコードで同一値なら直接セット（CASE不要）
            const values = recordsWithColumnUpdates.map((p) => p.updateData[col]);
            const allSame = values.every((v) => v === values[0]);

            if (allSame) {
              setClause[col] = values[0];
            } else {
              // レコードごとに異なる値: CASE WHEN 方式
              const colRef = (table as Record<string, any>)[col];
              const fragments = recordsWithColumnUpdates.map((p) => {
                const val = p.updateData[col];
                return val !== undefined
                  ? sql`WHEN ${p.id} THEN ${val}`
                  : sql`WHEN ${p.id} THEN ${colRef}`;
              });
              setClause[col] = sql.join(
                [sql`CASE ${idColumn}`, ...fragments, sql`END`],
                sql` `,
              );
            }
          }

          await executor
            .update(table)
            .set(setClause as PgUpdateSetSource<TTable>)
            .where(inArray(idColumn, bulkIds));
        }

        // belongsToMany リレーションを同期
        // 同一リレーション値のレコードをグルーピングして bulkSync 適用
        const recordsWithRelations = parsed.filter((p) => p.relationValues.size > 0);
        if (recordsWithRelations.length > 0) {
          // リレーション値をキーにグルーピング
          const groups = new Map<string, string[]>();
          for (const p of recordsWithRelations) {
            const key = JSON.stringify(
              Array.from(p.relationValues.entries()).sort(([a], [b]) => a.localeCompare(b)),
            );
            const group = groups.get(key) ?? [];
            group.push(p.id);
            groups.set(key, group);
          }

          for (const [key, groupIds] of groups) {
            const relationValues = recordsWithRelations.find(
              (p) => JSON.stringify(
                Array.from(p.relationValues.entries()).sort(([a], [b]) => a.localeCompare(b)),
              ) === key,
            )!.relationValues;
            await bulkSyncBelongsToManyRelations(
              executor as DbTransaction,
              belongsToManyRelations,
              groupIds,
              relationValues,
            );
          }
        }

        // 更新後のレコードを1クエリで取得
        const validIds = validRecords.map((r) => r.id);
        const updatedRows = (await executor
          .select()
          .from(table as any)
          .where(inArray(idColumn, validIds))) as Select[];

        // ローカルでリレーション値をアサイン
        for (const row of updatedRows) {
          const p = parsed.find((pp) => pp.id === (row as any).id);
          if (p && p.relationValues.size > 0) {
            assignLocalRelationValues(row as any, belongsToManyRelations, p.relationValues);
          }
        }

        return { results: updatedRows, count: updatedRows.length, notFoundIds };
      };

      if (tx) {
        return performBulkUpdate(tx);
      }
      if (hasBelongsToMany) {
        return db.transaction(async (innerTx) => performBulkUpdate(innerTx));
      }
      return performBulkUpdate(db);
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

      // 中間テーブル + メインテーブルを1クエリでTRUNCATE
      const throughTableNames = belongsToManyRelations.map((relation) =>
        getTableName(relation.throughTable),
      );
      const allTableNames = [...throughTableNames, mainTableName];
      const quotedNames = allTableNames.map((name) => `"${name}"`).join(", ");
      await db.execute(sql.raw(`TRUNCATE TABLE ${quotedNames} CASCADE`));
      truncatedTables.push(...allTableNames);

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
        .orderBy(desc(sortOrderColumn))
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

    /**
     * ソート画面用の検索メソッド。
     * 結果に sort_order が NULL のレコードがあれば自動的に初期化する。
     * 初期化順序は defaultOrderBy（未設定時は createdAt DESC）に従う。
     *
     * @param params - 検索パラメータ
     * @returns 検索結果（NULL が初期化済み）
     */
    async searchForSorting(params: SearchParams): Promise<PaginatedResult<Select>> {
      if (!sortOrderColumn) {
        throw new DomainError(
          "searchForSorting() requires sortOrderColumn to be configured in service options.",
          { status: 500 }
        );
      }

      const sortOrderFieldName = (sortOrderColumn as any).name as string;

      // 通常の検索を実行
      const results = await this.search(params);

      // sort_order が NULL のアイテムを抽出
      const nullItems = results.results.filter(
        (item: any) => item[sortOrderFieldName] === null || item[sortOrderFieldName] === undefined
      );

      if (nullItems.length === 0) {
        return results;
      }

      // NULL アイテムのIDを取得
      const nullIds = nullItems.map((item: any) => item.id as string);

      // defaultOrderBy に従って NULL アイテムの順序を決定
      const initOrderBy = serviceOptions.defaultOrderBy ?? [["createdAt", "DESC"]];
      const orderedNullItems = await db
        .select({ id: idColumn })
        .from(table as any)
        .where(inArray(idColumn, nullIds))
        .orderBy(...buildOrderBy(table, initOrderBy)) as { id: string }[];

      const orderedNullIds = orderedNullItems.map((item) => String(item.id));

      // sort_order を初期化し、割り当てられたキーマップを取得
      const keyMap = await this.initializeSortOrder(orderedNullIds);

      // 1回目の結果に初期化された sort_order をマージ（再searchを回避）
      for (const item of results.results) {
        const assignedKey = keyMap.get((item as any).id);
        if (assignedKey !== undefined) {
          (item as any)[sortOrderFieldName] = assignedKey;
        }
      }

      return results;
    },
  };
}
