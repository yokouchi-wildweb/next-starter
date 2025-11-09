// src/features/card/services/server/wrappers/create.ts
import { db } from "@/lib/drizzle";
import { CardToCardTagTable, CardToSeriesTable } from "@/features/card/entities/drizzle";
import { base } from "../drizzleBase";
import type { Card, CardCreateData } from "@/features/card/entities";

export async function create(data: CardCreateData): Promise<Card> {
  const { tagIds = [], seriesIds = [], ...cardData } = data;
  const created = (await base.create(cardData as any)) as any;
  if (tagIds.length) {
    await db.insert(CardToCardTagTable).values(tagIds.map((tagId) => ({ cardId: created.id, tagId })));
  }
  if (seriesIds.length) {
    await db.insert(CardToSeriesTable).values(seriesIds.map((seriesId) => ({ cardId: created.id, seriesId })));
  }
  return created;
}
