// src/features/sampleTag/entities/schemaRegistry.ts

import { emptyToNull } from "@/utils/string";
import { z } from "zod";

export const SampleTagBaseSchema = z.object({
  name: z.string().trim().min(1, { message: "タグ名は必須です。" }),
  description: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
});

export const SampleTagCreateSchema = SampleTagBaseSchema;

export const SampleTagUpdateSchema = SampleTagBaseSchema.partial();
