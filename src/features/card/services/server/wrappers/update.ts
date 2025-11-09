// src/features/card/services/server/wrappers/update.ts
import { db } from "@/lib/drizzle";
import { CardToCardTagTable, CardToSeriesTable } from "@/features/card/entities/drizzle";
import { eq } from "drizzle-orm";
import { base } from "../drizzleBase";
import type { Card, CardCreateData } from "@/features/card/entities";

export async function update(
  id: string,
  data: Partial<CardCreateData>,
): Promise<Card> {
  const { tagIds, seriesIds, ...cardData } = data;
  const updated = (await base.update(id, cardData as any)) as any;
  if (tagIds) {
    await db.delete(CardToCardTagTable).where(eq(CardToCardTagTable.cardId, id));
    if (tagIds.length) {
      await db.insert(CardToCardTagTable).values(tagIds.map((tagId) => ({ cardId: id, tagId })));
    }
  }
  if (seriesIds) {
    await db.delete(CardToSeriesTable).where(eq(CardToSeriesTable.cardId, id));
    if (seriesIds.length) {
      await db.insert(CardToSeriesTable).values(seriesIds.map((seriesId) => ({ cardId: id, seriesId })));
    }
  }
  return updated;
}
