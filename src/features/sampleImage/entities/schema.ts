// src/features/sampleImage/entities/schemaRegistry.ts

import { emptyToNull } from "@/utils/string";
import { storageMediaValueSchema } from "@/lib/storage/schema";
import { z } from "zod";

export const SampleImageBaseSchema = z.object({
  sample_id: z.string().trim().min(1, { message: "サンプルは必須です。" }),
  file: z.string().trim().min(1, { message: "画像は必須です。" }).pipe(storageMediaValueSchema),
  sort_order: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
});

export const SampleImageCreateSchema = SampleImageBaseSchema;

export const SampleImageUpdateSchema = SampleImageBaseSchema.partial();
