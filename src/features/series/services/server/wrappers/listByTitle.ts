// src/features/series/services/server/wrappers/listByTitle.ts
import { db } from "@/lib/drizzle";
import { SeriesTable } from "@/features/series/entities/drizzle";
import { eq, asc, desc } from "drizzle-orm";

export async function listByTitle(titleId?: string) {
  const baseQuery = db.select().from(SeriesTable);
  const query = titleId ? baseQuery.where(eq(SeriesTable.titleId, titleId)) : baseQuery;
  return await query.orderBy(asc(SeriesTable.titleId), desc(SeriesTable.updatedAt));
}
