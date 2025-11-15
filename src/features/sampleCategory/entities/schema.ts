// src/features/sampleCategory/entities/schemaRegistry.ts

import { emptyToNull } from "@/utils/string";
import { z } from "zod";

export const SampleCategoryBaseSchema = z.object({
  name: z.string().trim().min(1, { message: "カテゴリ名は必須です。" }),
  description: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
});

export const SampleCategoryCreateSchema = SampleCategoryBaseSchema;

export const SampleCategoryUpdateSchema = SampleCategoryBaseSchema.partial();
