// src/features/card/services/server/wrappers/get.ts
import { db } from "@/lib/drizzle";
import { CardToCardTagTable, CardToSeriesTable } from "@/features/card/entities/drizzle";
import { eq } from "drizzle-orm";
import { base } from "../drizzleBase";
import type { CardWithRelations } from "@/features/card/entities";

export async function get(id: string): Promise<CardWithRelations | undefined> {
  const card = await base.get(id);
  if (!card) return undefined;
    const tagRows = await db
      .select({ tagId: CardToCardTagTable.tagId })
      .from(CardToCardTagTable)
      .where(eq(CardToCardTagTable.cardId, id));
    const seriesRows = await db
      .select({ seriesId: CardToSeriesTable.seriesId })
      .from(CardToSeriesTable)
      .where(eq(CardToSeriesTable.cardId, id));
  return {
    ...card,
    tagIds: tagRows.map((r) => r.tagId),
    seriesIds: seriesRows.map((r) => r.seriesId),
  } as CardWithRelations;
}
