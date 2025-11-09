// src/features/bar/entities/schemaRegistry.ts

import { z } from "zod";

export const BarBaseSchema = z.object({
  titleId: z.string().optional(),
  rarityId: z.string().min(1, { message: "レアリティIDは必須です。" }),
  tagIds: z.array(z.string()).optional().default([]),
  seriesIds: z.array(z.string()).optional().default([]),
  name: z.string().min(1, { message: "カード名は必須です。" }),
  modelNumber: z.string().optional(),
  marketPrice: z.coerce.number().int().optional(),
  pointValue: z.coerce.number().int().optional(),
  cardType: z.enum(["real", "virtual"]).optional(),
  state: z.enum(["active", "inactive"]).optional(),
  description: z.string().optional(),
  mainImageUrl: z.string().optional(),
});

export const BarCreateSchema = BarBaseSchema;

export const BarUpdateSchema = BarBaseSchema.partial();
