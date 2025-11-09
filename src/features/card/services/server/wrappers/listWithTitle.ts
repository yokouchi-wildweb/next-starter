// src/features/card/services/server/wrappers/listWithTitle.ts
import { db } from "@/lib/drizzle";
import { CardTable } from "@/features/card/entities/drizzle";
import { TitleTable } from "@/features/title/entities/drizzle";
import { CardRarityTable } from "@/features/cardRarity/entities/drizzle";
import { eq, sql, asc, desc } from "drizzle-orm";

export async function listWithTitle(titleId?: string) {
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
    const query = titleId ? baseQuery.where(eq(CardTable.titleId, titleId)) : baseQuery;
    return await query.orderBy(asc(CardTable.titleId), desc(CardTable.updatedAt));
}
