// src/features/cardTag/entities/schemaRegistry.ts

import { z } from "zod";

export const CardTagBaseSchema = z.object({
  name: z.string().min(1, { message: "タグ名は必須" }),
  description: z.string().nullish(),
});

export const CardTagCreateSchema = CardTagBaseSchema;

export const CardTagUpdateSchema = CardTagBaseSchema.partial();
