// src/features/gacha/services/server/wrappers/draw.ts
import { db } from "@/lib/drizzle";
import { CardTable } from "@/features/card/entities/drizzle";
import { TitleTable } from "@/features/title/entities/drizzle";
import { CardRarityTable } from "@/features/cardRarity/entities/drizzle";
import { eq, sql } from "drizzle-orm";
import type { CardWithNames } from "@/features/card/entities";

export async function draw(count: number): Promise<CardWithNames[]> {
  const cards = await db
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
      .leftJoin(CardRarityTable, eq(sql`${CardTable.rarityId}::uuid`, CardRarityTable.id))
    .orderBy(sql`RANDOM()`)
    .limit(count);
  return cards.map((c) => ({ ...c, titleName: c.titleName ?? "", rarityName: c.rarityName ?? "" }));
}
