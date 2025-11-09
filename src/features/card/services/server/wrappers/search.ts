// src/features/card/services/server/wrappers/search.ts
import { db } from "@/lib/drizzle";
import { CardTable } from "@/features/card/entities/drizzle";
import { TitleTable } from "@/features/title/entities/drizzle";
import { CardRarityTable } from "@/features/cardRarity/entities/drizzle";
import { eq, sql, asc, desc, ilike, or, and, type SQL } from "drizzle-orm";
import { base } from "../drizzleBase";
import type { CardWithNames } from "@/features/card/entities";

export async function search(params: { page?: number; limit?: number; titleId?: string; keyword?: string }) {
  const { page, limit, titleId, keyword } = params;
  const baseQuery = db
      .select({
        id: CardTable.id,
        name: CardTable.name,
        modelNumber: CardTable.modelNumber,
        titleId: CardTable.titleId,
        rarityId: CardTable.rarityId,
        marketPrice: CardTable.marketPrice,
        pointValue: CardTable.pointValue,
        cardType: CardTable.cardType,
        state: CardTable.state,
        description: CardTable.description,
        mainImageUrl: CardTable.mainImageUrl,
        createdAt: CardTable.createdAt,
        updatedAt: CardTable.updatedAt,
        titleName: TitleTable.name,
        rarityName: CardRarityTable.name,
      })
      .from(CardTable)
      .leftJoin(TitleTable, eq(sql`${CardTable.titleId}::uuid`, TitleTable.id))
      .leftJoin(CardRarityTable, eq(sql`${CardTable.rarityId}::uuid`, CardRarityTable.id));
  const conditions: any[] = [];
    if (titleId) {
      conditions.push(eq(CardTable.titleId, titleId));
    }
    if (keyword) {
      const pattern = `%${keyword}%`;
      conditions.push(
        or(ilike(CardTable.name, pattern), ilike(CardTable.modelNumber, pattern), ilike(CardTable.description, pattern)),
      );
    }
  const where = conditions.length ? (and(...conditions) as SQL) : undefined;
  const query = where ? baseQuery.where(where) : baseQuery;
    const { results, total } = await base.query<CardWithNames>(query, {
      page,
      limit,
      orderBy: [asc(CardTable.titleId), desc(CardTable.updatedAt)],
      where,
    });
  return { cards: results, total } as { cards: CardWithNames[]; total: number };
}
