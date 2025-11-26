// src/lib/crud/drizzle/service.ts

import { db } from "@/lib/drizzle";
import { omitUndefined } from "@/utils/object";
import { eq, inArray, SQL, ilike, and, or, sql } from "drizzle-orm";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { PgTable, AnyPgColumn, PgUpdateSetSource } from "drizzle-orm/pg-core";
import type {
  SearchParams,
  CreateCrudServiceOptions,
  PaginatedResult,
  UpsertOptions,
  WhereExpr,
} from "../types";
import { buildOrderBy, buildWhere, runQuery } from "./query";
import { applyInsertDefaults, resolveConflictTarget } from "./utils";

export type DefaultInsert<TTable extends PgTable> = Omit<
  InferInsertModel<TTable>,
  "id" | "createdAt" | "updatedAt"
>;

export function createCrudService<
  TTable extends PgTable & { id: AnyPgColumn },
  TCreate extends Record<string, any> = DefaultInsert<TTable>
>(table: TTable, serviceOptions: CreateCrudServiceOptions<TCreate> = {}) {
  type Select = InferSelectModel<TTable>;
  type Insert = TCreate;
  const idColumn = table.id;

  return {
    async create(data: Insert): Promise<Select> {
      const parsedInput = serviceOptions.parseCreate
        ? await serviceOptions.parseCreate(data)
        : data;
      const finalInsert = applyInsertDefaults(parsedInput, serviceOptions) as Insert;
      const rows = await db.insert(table).values(finalInsert).returning();
      return rows[0] as Select;
    },

    async list(): Promise<Select[]> {
      let query: any = db.select().from(table as any);
      const orderClauses = buildOrderBy(table, serviceOptions.defaultOrderBy);
      if (orderClauses.length) query = query.orderBy(...orderClauses);
      return (await query) as Select[];
    },

    async get(id: string): Promise<Select | undefined> {
      const rows = (await db
        .select()
        .from(table as any)
        .where(eq(idColumn, id))) as Select[];
      return rows[0] as Select | undefined;
    },

    async update(id: string, data: Partial<Insert>): Promise<Select> {
      const parsed = serviceOptions.parseUpdate
        ? await serviceOptions.parseUpdate(data)
        : data;
      const updateData = {
        ...omitUndefined(parsed as Record<string, any>),
      } as Partial<Insert> & Record<string, any> & { updatedAt?: Date };

      if (serviceOptions.useUpdatedAt && updateData.updatedAt === undefined) {
        updateData.updatedAt = new Date();
      }

      const rows = await db
        .update(table)
        .set(updateData as PgUpdateSetSource<TTable>)
        .where(eq(idColumn, id))
        .returning();
      return rows[0] as Select;
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
      return runQuery(table, baseQuery, {
        page,
        limit,
        orderBy: orderClauses,
        where: finalWhere,
      });
    },

    async query<T>(
      baseQuery: any,
      options: { page?: number; limit?: number; orderBy?: SQL[]; where?: SQL } = {},
      countQuery?: any,
    ): Promise<PaginatedResult<T>> {
      return runQuery(table, baseQuery, options, countQuery);
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

      const sanitizedInsert = applyInsertDefaults(parsedInput, serviceOptions) as Insert & {
        id?: string;
        createdAt?: Date;
        updatedAt?: Date;
      };

      const updateData = {
        ...sanitizedInsert,
      } as PgUpdateSetSource<TTable> & Record<string, any> & { id?: string };
      delete (updateData as Record<string, unknown>).id;

      const rows = await db
        .insert(table)
        .values(sanitizedInsert as any)
        .onConflictDoUpdate({
          target: resolveConflictTarget(table, serviceOptions, upsertOptions),
          set: updateData,
        })
        .returning();
      return rows[0] as Select;
    },
  };
}
