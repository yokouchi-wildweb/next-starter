// src/features/sampleCategory/entities/schemaRegistry.ts

import { z } from "zod";

export const SampleCategoryBaseSchema = z.object({
  name: z.string().min(1, { message: "カテゴリ名は必須です。" }),
  description: z.string().nullish(),
});

export const SampleCategoryCreateSchema = SampleCategoryBaseSchema;

export const SampleCategoryUpdateSchema = SampleCategoryBaseSchema.partial();
