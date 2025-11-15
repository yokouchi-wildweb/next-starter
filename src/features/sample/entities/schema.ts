// src/features/sample/entities/schemaRegistry.ts

import { emptyToNull } from "@/utils/string";
import { z } from "zod";

export const SampleBaseSchema = z.object({
  sample_category_id: z.string(),
  name: z.string().min(1, { message: "名前は必須です。" }),
  number: z.coerce.number().int().nullish(),
  rich_number: z.coerce.number().int().nullish(),
  switch: z.coerce.boolean().nullish(),
  radio: z.coerce.boolean().nullish(),
  select: z.enum(["apple", "orange", "berry"]).nullish(),
  main_image: z.string().nullish()
    .transform((value) => emptyToNull(value)),
  description: z.string().nullish()
    .transform((value) => emptyToNull(value)),
});

export const SampleCreateSchema = SampleBaseSchema;

export const SampleUpdateSchema = SampleBaseSchema.partial();
