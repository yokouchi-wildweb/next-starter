// src/lib/crud/drizzle/index.ts
// Drizzle ORM を利用した汎用的な CRUD サービスを提供するモジュール

import { db } from "@/lib/drizzle";
import { eq, inArray, SQL, ilike, and, or, sql } from "drizzle-orm";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { PgTable, AnyPgColumn, PgUpdateSetSource } from "drizzle-orm/pg-core";
import type { ZodType } from "zod";
import type {
  SearchParams,
  CreateCrudServiceOptions,
  PaginatedResult,
  UpsertOptions,
} from "../types";
import { normalizeUndefinedToNull, omitUndefined } from "../utils";
import { uuidv7 } from "uuidv7";
import { buildOrderBy, buildWhere, runQuery } from "./query";

const parseWithSchema = <T>(schema: ZodType<T> | undefined, value: unknown): T | undefined => {
  if (!schema) return undefined;
  const result = schema.safeParse(value);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
};

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
  // CRUD 操作対象のテーブルには必ず `id` カラムが存在することを想定
  const idColumn = table.id;

  const defaultConflictFields = serviceOptions.defaultUpsertConflictFields as
    | Array<Extract<keyof Insert, string>>
    | undefined;

  const resolveConflictTarget = (options?: UpsertOptions<Insert>) => {
    const conflictFields = options?.conflictFields ?? defaultConflictFields;
    if (!conflictFields || conflictFields.length === 0) {
      return idColumn;
    }

    const columns = conflictFields.map((field) => {
      const column = (table as any)[field];
      if (!column) {
        throw new Error(`Unknown column \"${String(field)}\" specified for upsert conflict target.`);
      }
      return column as AnyPgColumn;
    });

    return columns.length === 1 ? columns[0] : columns;
  };

  // ここから CRUD 向けのメソッドをまとめて返す
  return {
    // レコードを新規作成する
    async create(data: Insert): Promise<Select> {
      const createPayload = { ...(data as Record<string, any>) };
      const providedId = createPayload.id;
      delete createPayload.id;
      const parsed = parseWithSchema(serviceOptions.schemas?.create, createPayload);
      const insertData = { ...((parsed ?? createPayload) as Insert) } as Insert &
        Record<string, any> & { id?: string; createdAt?: Date; updatedAt?: Date };
      if (providedId !== undefined) {
        insertData.id = providedId;
      }
      if (serviceOptions.useCreatedAt && insertData.createdAt === undefined) {
        insertData.createdAt = new Date();
      }
      if (serviceOptions.useUpdatedAt && insertData.updatedAt === undefined) {
        insertData.updatedAt = new Date();
      }
      if (serviceOptions.idType === "uuid") {
        insertData.id = uuidv7();
      } else if (serviceOptions.idType === "db") {
        delete insertData.id;
      }
      const normalized = normalizeUndefinedToNull(insertData) as Insert;
      const rows = await db.insert(table).values(normalized).returning();
      return rows[0] as Select;
    },

    // テーブルの全レコードを取得する
    async list(): Promise<Select[]> {
      let query: any = db.select().from(table as any);
      const orderClauses = buildOrderBy(table, serviceOptions.defaultOrderBy);
      if (orderClauses.length) query = query.orderBy(...orderClauses);
      return (await query) as Select[];
    },

    // ID を指定して単一のレコードを取得する
    async get(id: string): Promise<Select | undefined> {
      const rows = (await db
        .select()
        .from(table as any)
        .where(eq(idColumn, id))) as Select[];
      return rows[0] as Select | undefined;
    },

    // 指定 ID のレコードを更新する
    async update(id: string, data: Partial<Insert>): Promise<Select> {
      const updatePayload = { ...(data as Record<string, any>) };
      delete updatePayload.id;
      const parsed = parseWithSchema(serviceOptions.schemas?.update, updatePayload);
      const sanitizedSource = (parsed ?? updatePayload) as Partial<Insert>;
      const sanitized = { ...omitUndefined(sanitizedSource) } as Partial<Insert> &
        Record<string, any> & { updatedAt?: Date };
      if (serviceOptions.useUpdatedAt && sanitized.updatedAt === undefined) {
        sanitized.updatedAt = new Date();
      }
      const normalized = normalizeUndefinedToNull(sanitized);
      const rows = await db.update(table).set(normalized).where(eq(idColumn, id)).returning();
      return rows[0] as Select;
    },

    // 指定 ID のレコードを削除する
    async remove(id: string): Promise<void> {
      await db.delete(table).where(eq(idColumn, id));
    },

    // where 条件を指定してページング検索を行う
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

    // 複雑なクエリをページング付きで実行する
      async query<T>(
        baseQuery: any,
        options: { page?: number; limit?: number; orderBy?: SQL[]; where?: SQL } = {},
        countQuery?: any,
      ): Promise<PaginatedResult<T>> {
      return runQuery(table, baseQuery, options, countQuery);
    },

    // ID の配列を指定して一括削除を行う
    async bulkDelete(ids: string[]): Promise<void> {
      await db.delete(table).where(inArray(idColumn, ids));
    },
    // レコードが存在すれば更新、存在しなければ作成する
    async upsert(data: Insert & { id?: string }, upsertOptions?: UpsertOptions<Insert>): Promise<Select> {
      const upsertPayload = { ...(data as Record<string, any>) };
      const providedId = upsertPayload.id;
      delete upsertPayload.id;
      const parsed = parseWithSchema(
        serviceOptions.schemas?.upsert ?? serviceOptions.schemas?.create,
        upsertPayload,
      );
      const insertData = { ...((parsed ?? upsertPayload) as Insert) } as Record<string, any> & {
        id?: string;
        createdAt?: Date;
        updatedAt?: Date;
      };
      if (providedId !== undefined) {
        insertData.id = providedId;
      }
      if (serviceOptions.useCreatedAt && insertData.createdAt === undefined) {
        insertData.createdAt = new Date();
      }
      if (serviceOptions.useUpdatedAt && insertData.updatedAt === undefined) {
        insertData.updatedAt = new Date();
      }
      if (serviceOptions.idType === "uuid") {
        insertData.id = uuidv7();
      } else if (serviceOptions.idType === "db") {
        delete insertData.id;
      }
      const sanitizedInsert = omitUndefined(insertData);
      const normalized = normalizeUndefinedToNull(sanitizedInsert as Record<string, any>);
      const updateData = { ...normalized } as PgUpdateSetSource<TTable> &
        Record<string, any> & { id?: string; updatedAt?: Date };
      if (serviceOptions.useUpdatedAt && updateData.updatedAt === undefined) {
        updateData.updatedAt = new Date();
      }
      delete (updateData as Record<string, unknown>).id;
      const rows = await db
        .insert(table)
        .values(normalized as any)
        .onConflictDoUpdate({ target: resolveConflictTarget(upsertOptions), set: updateData })
        .returning();
      return rows[0] as Select;
    },
  };
}
