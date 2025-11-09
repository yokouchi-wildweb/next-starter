// src/features/series/entities/schemaRegistry.ts

import { z } from "zod";

export const SeriesBaseSchema = z.object({
  titleId: z.string().min(1, { message: "タイトルIDは必須" }),
  name: z.string().min(1, { message: "シリーズ名は必須" }),
  description: z.string().nullish(),
  releaseDate: z.string().nullish(),
});

export const SeriesCreateSchema = SeriesBaseSchema;

export const SeriesUpdateSchema = SeriesBaseSchema.partial();
