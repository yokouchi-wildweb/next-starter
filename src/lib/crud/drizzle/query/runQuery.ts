import { db } from "@/lib/drizzle";
import { sql, SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { PaginatedResult } from "@/lib/crud/types";

export const runQuery = async <T>(
  table: PgTable,
  baseQuery: any,
  options: { page?: number; limit?: number; orderBy?: SQL[]; where?: SQL } = {},
  countQuery?: any,
): Promise<PaginatedResult<T>> => {
  const { page = 1, limit = 100, orderBy = [], where } = options;
  const offset = (page - 1) * limit;

  let resultQuery = baseQuery as any;
  if (where) resultQuery = resultQuery.where(where);
  if (orderBy.length) resultQuery = resultQuery.orderBy(...(orderBy as any[]));
  const results = await resultQuery.limit(limit).offset(offset);

  let totalQuery: any;
  if (countQuery) {
    totalQuery = countQuery;
    if (where) totalQuery = totalQuery.where(where);
  } else {
    totalQuery = db.select({ count: sql<number>`count(*)` }).from(table as any);
    if (where) totalQuery = totalQuery.where(where);
  }
  const [{ count }] = await totalQuery;

  return { results: results as T[], total: Number(count) };
};
