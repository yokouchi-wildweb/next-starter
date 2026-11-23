// src/lib/crud/drizzle/service/read.ts
// 読みの群: list / get / count / search と、論理削除済みも含める *WithDeleted

import { db } from "@/lib/drizzle";
import { eq, SQL, and, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import type { PgTable, AnyPgColumn } from "drizzle-orm/pg-core";
import { DomainError } from "@/lib/errors";
import type { BoundedSearchParams, CountParams, CountResult, PaginatedResult, WithOptions } from "../../types";
import { buildOrderBy, buildRelationWhere, buildWhere, runQuery, buildSearchWhere, buildSearchRankOrderBy, normalizeSearchRankSpec, composeSearchOrderBy } from "../query";
import type { ExtraWhereClause, ExtraOrderByClause } from "../types";
import { hydrateBelongsToManyRelations } from "../belongsToMany";
import type { ServiceContext } from "./context";

/**
 * 型(BoundedSearchParams)を通らない呼び出し(any で受けたサービス・登録表から引いたサービス)の limit の抜けを止める。
 * 既定で黙って行を落とさない: 外から来る limit は resolveSearchLimit で解いてから渡す
 */
function assertSearchLimit(limit: unknown): asserts limit is number {
  if (!Number.isInteger(limit) || (limit as number) <= 0) {
    throw new DomainError("search の limit は正の整数が必須です(外から来る limit は resolveSearchLimit で解く)", { status: 500 });
  }
}

export function createReadMethods<TTable extends PgTable & { id: AnyPgColumn }, TCreate extends Record<string, any>>(ctx: ServiceContext<TTable, TCreate>) {
  type Select = InferSelectModel<TTable>;
  const { table, serviceOptions, idColumn, belongsToManyRelations, belongsToRelations, sortOrderColumn, buildSoftDeleteFilter, hydrateRelations } = ctx;
  return {
    async list(options?: WithOptions): Promise<Select[]> {
      const limit = options?.limit ?? 100;
      let query: any = db.select().from(table as any);
      const softDeleteFilter = buildSoftDeleteFilter();
      if (softDeleteFilter) query = query.where(softDeleteFilter);
      const orderClauses = buildOrderBy(table, serviceOptions.defaultOrderBy, { sortKeyColumn: sortOrderColumn });
      if (orderClauses.length) query = query.orderBy(...orderClauses);
      query = query.limit(limit);
      const results = (await query) as Select[];

      // 既存の belongsToMany ID配列の hydrate
      if (belongsToManyRelations.length) {
        await hydrateBelongsToManyRelations(results, belongsToManyRelations);
      }

      // withRelations / withCount
      await hydrateRelations(results, options);

      return results;
    },
    async listWithDeleted(options?: WithOptions): Promise<Select[]> {
      let query: any = db.select().from(table as any);
      const orderClauses = buildOrderBy(table, serviceOptions.defaultOrderBy, { sortKeyColumn: sortOrderColumn });
      if (orderClauses.length) query = query.orderBy(...orderClauses);
      const results = (await query) as Select[];

      // 既存の belongsToMany ID配列の hydrate
      if (belongsToManyRelations.length) {
        await hydrateBelongsToManyRelations(results, belongsToManyRelations);
      }

      // withRelations / withCount
      await hydrateRelations(results, options);

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

      // withRelations / withCount
      await hydrateRelations([record], options);

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

      // withRelations / withCount
      await hydrateRelations([record], options);

      return record;
    },
    async count(params: CountParams & ExtraWhereClause = {}): Promise<CountResult> {
      const {
        searchQuery,
        searchFields = serviceOptions.defaultSearchFields,
        where,
        extraWhere,
        relationWhere,
      } = params;

      let finalWhere = buildWhere(table, where);
      if (extraWhere) {
        finalWhere = and(finalWhere, extraWhere) as SQL;
      }
      if (relationWhere?.length) {
        const relationCondition = buildRelationWhere(table, idColumn, relationWhere, belongsToManyRelations, belongsToRelations);
        if (relationCondition) {
          finalWhere = and(finalWhere, relationCondition) as SQL;
        }
      }
      const softDeleteFilter = buildSoftDeleteFilter();
      if (softDeleteFilter) {
        finalWhere = finalWhere ? and(finalWhere, softDeleteFilter) as SQL : softDeleteFilter;
      }

      if (searchQuery && searchFields && searchFields.length) {
        finalWhere = and(finalWhere, buildSearchWhere(table, searchQuery, searchFields)) as SQL;
      }

      const totalQuery = db.select({ count: sql<number>`count(*)` }).from(table as any);
      const [{ count }] = await (finalWhere ? totalQuery.where(finalWhere) : totalQuery);
      return { total: Number(count) };
    },
    async search(params: BoundedSearchParams & WithOptions & ExtraWhereClause & ExtraOrderByClause): Promise<PaginatedResult<Select>> {
      const {
        page = 1,
        limit,
        orderBy = serviceOptions.defaultOrderBy,
        searchQuery,
        searchFields = serviceOptions.defaultSearchFields,
        where,
        extraWhere,
        extraOrderBy,
        relationWhere,
        withRelations,
        withCount,
        hasManyLimit,
      } = params;
      assertSearchLimit(limit);

      let finalWhere = buildWhere(table, where);
      // extraWhere（Drizzle SQL条件）を合成
      if (extraWhere) {
        finalWhere = and(finalWhere, extraWhere) as SQL;
      }
      // relationWhere（belongsToManyリレーションフィルタ）を合成
      if (relationWhere?.length) {
        const relationCondition = buildRelationWhere(table, idColumn, relationWhere, belongsToManyRelations, belongsToRelations);
        if (relationCondition) {
          finalWhere = and(finalWhere, relationCondition) as SQL;
        }
      }
      // ソフトデリートフィルターを追加
      const softDeleteFilter = buildSoftDeleteFilter();
      if (softDeleteFilter) {
        finalWhere = finalWhere ? and(finalWhere, softDeleteFilter) as SQL : softDeleteFilter;
      }

      // 関連度ランキング（searchRank）。指定時のみ orderBy の前に置く
      const rankFields = normalizeSearchRankSpec(params.searchRank, searchFields, serviceOptions.defaultSearchRank);
      let rankOrderClause: SQL | undefined;
      if (searchQuery && searchFields && searchFields.length) {
        finalWhere = and(finalWhere, buildSearchWhere(table, searchQuery, searchFields)) as SQL;

        if (rankFields.length) {
          rankOrderClause = buildSearchRankOrderBy(table, searchQuery, rankFields);
        }
      }

      const baseQuery = db.select().from(table as any);
      // rank → extraOrderBy（SQL 式）→ orderBy の順に並べ、末尾に id を足す（既に含まれていない場合のみ、ソート順の安定性を保証）
      const orderClauses = composeSearchOrderBy(table, orderBy, {
        rank: rankOrderClause,
        extra: extraOrderBy,
        base: buildOrderBy(table, orderBy, { sortKeyColumn: sortOrderColumn }),
      });
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

      // withRelations / withCount
      await hydrateRelations(result.results, { withRelations, withCount, hasManyLimit });

      return result;
    },
    async countWithDeleted(params: CountParams & ExtraWhereClause = {}): Promise<CountResult> {
      const {
        searchQuery,
        searchFields = serviceOptions.defaultSearchFields,
        where,
        extraWhere,
        relationWhere,
      } = params;

      let finalWhere = buildWhere(table, where);
      if (extraWhere) {
        finalWhere = and(finalWhere, extraWhere) as SQL;
      }
      if (relationWhere?.length) {
        const relationCondition = buildRelationWhere(table, idColumn, relationWhere, belongsToManyRelations, belongsToRelations);
        if (relationCondition) {
          finalWhere = and(finalWhere, relationCondition) as SQL;
        }
      }
      // ソフトデリートフィルターなし（削除済み含む）

      if (searchQuery && searchFields && searchFields.length) {
        finalWhere = and(finalWhere, buildSearchWhere(table, searchQuery, searchFields)) as SQL;
      }

      const totalQuery = db.select({ count: sql<number>`count(*)` }).from(table as any);
      const [{ count }] = await (finalWhere ? totalQuery.where(finalWhere) : totalQuery);
      return { total: Number(count) };
    },
    async searchWithDeleted(params: BoundedSearchParams & WithOptions & ExtraWhereClause & ExtraOrderByClause): Promise<PaginatedResult<Select>> {
      const {
        page = 1,
        limit,
        orderBy = serviceOptions.defaultOrderBy,
        searchQuery,
        searchFields = serviceOptions.defaultSearchFields,
        where,
        extraWhere,
        extraOrderBy,
        relationWhere,
        withRelations,
        withCount,
        hasManyLimit,
      } = params;
      assertSearchLimit(limit);

      let finalWhere = buildWhere(table, where);
      // extraWhere（Drizzle SQL条件）を合成
      if (extraWhere) {
        finalWhere = and(finalWhere, extraWhere) as SQL;
      }
      // relationWhere（belongsToManyリレーションフィルタ）を合成
      if (relationWhere?.length) {
        const relationCondition = buildRelationWhere(table, idColumn, relationWhere, belongsToManyRelations, belongsToRelations);
        if (relationCondition) {
          finalWhere = and(finalWhere, relationCondition) as SQL;
        }
      }
      // 関連度ランキング（searchRank）。指定時のみ orderBy の前に置く
      const rankFields = normalizeSearchRankSpec(params.searchRank, searchFields, serviceOptions.defaultSearchRank);
      let rankOrderClause: SQL | undefined;
      if (searchQuery && searchFields && searchFields.length) {
        finalWhere = and(finalWhere, buildSearchWhere(table, searchQuery, searchFields)) as SQL;

        if (rankFields.length) {
          rankOrderClause = buildSearchRankOrderBy(table, searchQuery, rankFields);
        }
      }

      const baseQuery = db.select().from(table as any);
      // rank → extraOrderBy（SQL 式）→ orderBy の順に並べ、末尾に id を足す（既に含まれていない場合のみ、ソート順の安定性を保証）
      const orderClauses = composeSearchOrderBy(table, orderBy, {
        rank: rankOrderClause,
        extra: extraOrderBy,
        base: buildOrderBy(table, orderBy, { sortKeyColumn: sortOrderColumn }),
      });
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

      // withRelations / withCount
      await hydrateRelations(result.results, { withRelations, withCount, hasManyLimit });

      return result;
    },

    async query<TSelect extends Record<string, any> = Select>(
      baseQuery: any,
      options: { page?: number; limit?: number; orderBy?: SQL[]; where?: SQL } & WithOptions = {},
      countQuery?: any,
    ): Promise<PaginatedResult<TSelect>> {
      const { withRelations, withCount, hasManyLimit, ...queryOptions } = options;
      const result = await runQuery<TSelect>(table, baseQuery, queryOptions, countQuery);

      // 既存の belongsToMany ID配列の hydrate
      if (belongsToManyRelations.length) {
        await hydrateBelongsToManyRelations(result.results, belongsToManyRelations);
      }

      // withRelations / withCount
      await hydrateRelations(result.results, { withRelations, withCount, hasManyLimit });

      return result;
    },
  };
}
