// src/features/cardRarity/services/server/wrappers/listWithTitle.ts
import { db } from "@/lib/drizzle";
import { CardRarityTable } from "@/features/cardRarity/entities/drizzle";
import { TitleTable } from "@/features/title/entities/drizzle";
import { eq, sql, asc, desc } from "drizzle-orm";

export async function listWithTitle(titleId?: string) {
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
    const query = titleId ? baseQuery.where(eq(CardRarityTable.titleId, titleId)) : baseQuery;
    return await query.orderBy(asc(CardRarityTable.titleId), asc(CardRarityTable.sortOrder), desc(CardRarityTable.updatedAt));
}
