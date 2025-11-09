// src/features/cardRarity/services/server/wrappers/search.ts
import { db } from "@/lib/drizzle";
import { CardRarityTable } from "@/features/cardRarity/entities/drizzle";
import { TitleTable } from "@/features/title/entities/drizzle";
import { eq, sql, asc, desc } from "drizzle-orm";
import { base } from "../drizzleBase";
import type { CardRarityWithTitle } from "@/features/cardRarity/entities";

export async function search(params: { page?: number; limit?: number; titleId?: string }) {
  const { page, limit, titleId } = params;
    const baseQuery = db
      .select({
        id: CardRarityTable.id,
        titleId: CardRarityTable.titleId,
        name: CardRarityTable.name,
        sortOrder: CardRarityTable.sortOrder,
        description: CardRarityTable.description,
        createdAt: CardRarityTable.createdAt,
        updatedAt: CardRarityTable.updatedAt,
        titleName: TitleTable.name,
      })
      .from(CardRarityTable)
      .leftJoin(TitleTable, eq(sql`${CardRarityTable.titleId}::uuid`, TitleTable.id));
    const where = titleId ? eq(CardRarityTable.titleId, titleId) : undefined;
  const query = where ? baseQuery.where(where) : baseQuery;
    const { results, total } = await base.query<CardRarityWithTitle>(query, {
      page,
      limit,
      orderBy: [asc(CardRarityTable.titleId), asc(CardRarityTable.sortOrder), desc(CardRarityTable.updatedAt)],
      where,
    });
  return { rarities: results, total } as { rarities: CardRarityWithTitle[]; total: number };
}
