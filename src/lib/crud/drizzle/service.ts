// src/lib/crud/drizzle/service.ts

import { db } from "@/lib/drizzle";
import { omitUndefined } from "@/utils/object";
import { eq, inArray, SQL, ilike, and, or, sql } from "drizzle-orm";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { PgTable, AnyPgColumn, PgUpdateSetSource } from "drizzle-orm/pg-core";
import type { SearchParams, PaginatedResult, UpsertOptions, WhereExpr } from "../types";
import { buildOrderBy, buildWhere, runQuery } from "./query";
import { applyInsertDefaults, resolveConflictTarget } from "./utils";
import type { DrizzleCrudServiceOptions } from "./types";
import {
  assignLocalRelationValues,
  hydrateBelongsToManyRelations,
  separateBelongsToManyInput,
  syncBelongsToManyRelations,
} from "./belongsToMany";

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

  return {
    async create(data: Insert): Promise<Select> {
      const parsedInput = serviceOptions.parseCreate
        ? await serviceOptions.parseCreate(data)
        : data;
      const { sanitizedData, relationValues } = separateBelongsToManyInput(
        parsedInput,
        belongsToManyRelations,
      );
      const finalInsert = applyInsertDefaults(sanitizedData as Insert, serviceOptions) as Insert;

      if (!belongsToManyRelations.length) {
        const rows = await db.insert(table).values(finalInsert).returning();
        return rows[0] as Select;
      }

      return db.transaction(async (tx) => {
        const rows = await tx.insert(table).values(finalInsert).returning();
        const created = rows[0] as Select;
        if (!created) return created;
        await syncBelongsToManyRelations(tx, belongsToManyRelations, created.id, relationValues);
        assignLocalRelationValues(created, belongsToManyRelations, relationValues);
        return created;
      });
    },

    async list(): Promise<Select[]> {
      let query: any = db.select().from(table as any);
      const orderClauses = buildOrderBy(table, serviceOptions.defaultOrderBy);
      if (orderClauses.length) query = query.orderBy(...orderClauses);
      const results = (await query) as Select[];
      if (!belongsToManyRelations.length) return results;
      return hydrateBelongsToManyRelations(results, belongsToManyRelations);
    },

    async get(id: string): Promise<Select | undefined> {
      const rows = (await db
        .select()
        .from(table as any)
        .where(eq(idColumn, id))) as Select[];
      const record = rows[0] as Select | undefined;
      if (!record || !belongsToManyRelations.length) return record;
      await hydrateBelongsToManyRelations([record], belongsToManyRelations);
      return record;
    },

    async update(id: string, data: Partial<Insert>): Promise<Select> {
      const parsed = serviceOptions.parseUpdate
        ? await serviceOptions.parseUpdate(data)
        : data;
      const { sanitizedData, relationValues } = separateBelongsToManyInput(
        parsed as Record<string, any>,
        belongsToManyRelations,
      );
      const updateData = {
        ...omitUndefined(sanitizedData as Record<string, any>),
      } as Partial<Insert> & Record<string, any> & { updatedAt?: Date };

      if (serviceOptions.useUpdatedAt && updateData.updatedAt === undefined) {
        updateData.updatedAt = new Date();
      }

      const shouldSyncRelations = belongsToManyRelations.length > 0 && relationValues.size > 0;

      if (!shouldSyncRelations) {
        const rows = await db
          .update(table)
          .set(updateData as PgUpdateSetSource<TTable>)
          .where(eq(idColumn, id))
          .returning();
        return rows[0] as Select;
      }

      return db.transaction(async (tx) => {
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
      });
    },

    async remove(id: string): Promise<void> {
      await db.delete(table).where(eq(idColumn, id));
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

      const baseQuery: any = db.select().from(table as any);
      const orderByClauses = buildOrderBy(table, orderBy);
      const orderClauses = prioritizeSearchHits
        ? [...priorityOrderClauses, ...orderByClauses]
        : [...orderByClauses, ...priorityOrderClauses];
      const result = await runQuery(table, baseQuery, {
        page,
        limit,
        orderBy: orderClauses,
        where: finalWhere,
      });
      if (!belongsToManyRelations.length) return result;
      await hydrateBelongsToManyRelations(result.results, belongsToManyRelations);
      return result;
    },

    async query<T>(
      baseQuery: any,
      options: { page?: number; limit?: number; orderBy?: SQL[]; where?: SQL } = {},
      countQuery?: any,
    ): Promise<PaginatedResult<T>> {
      const result = await runQuery(table, baseQuery, options, countQuery);
      if (!belongsToManyRelations.length) return result;
      await hydrateBelongsToManyRelations(result.results, belongsToManyRelations);
      return result;
    },

    async bulkDeleteByIds(ids: string[]): Promise<void> {
      await db.delete(table).where(inArray(idColumn, ids));
    },

    async bulkDeleteByQuery(where: WhereExpr): Promise<void> {
      if (!where) {
        throw new Error("bulkDeleteByQuery requires a where condition.");
      }
      const condition = buildWhere(table, where);
      await db.delete(table).where(condition);
    },

    async upsert(data: Insert & { id?: string }, upsertOptions?: UpsertOptions<Insert>): Promise<Select> {
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

      if (!belongsToManyRelations.length) {
        const rows = await db
          .insert(table)
          .values(sanitizedInsert as any)
          .onConflictDoUpdate({
            target: resolveConflictTarget(table, serviceOptions, upsertOptions),
            set: updateData,
          })
          .returning();
        return rows[0] as Select;
      }

      return db.transaction(async (tx) => {
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
        await syncBelongsToManyRelations(tx, belongsToManyRelations, upserted.id, relationValues);
        assignLocalRelationValues(upserted, belongsToManyRelations, relationValues);
        return upserted;
      });
    },
  };
}
