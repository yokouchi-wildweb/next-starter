// src/features/cardRarity/entities/schemaRegistry.ts

import { z } from "zod";

export const CardRarityBaseSchema = z.object({
  titleId: z.string().min(1, { message: "タイトルIDは必須" }),
  name: z.string().min(1, { message: "レアリティ名は必須" }),
  sortOrder: z.coerce.number().int().nullish(),
  description: z.string().nullish(),
});

export const CardRarityCreateSchema = CardRarityBaseSchema;

export const CardRarityUpdateSchema = CardRarityBaseSchema.partial();
