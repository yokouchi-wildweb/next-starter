// src/features/sample/entities/schemaRegistry.ts

import { emptyToNull } from "@/utils/string";
import { z } from "zod";

export const SampleBaseSchema = z.object({
  sample_category_id: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  sample_tag_ids: z.array(z.string()).default([]),
  name: z.string().trim().min(1, { message: "名前は必須です。" }),
  number: z.coerce.number().int().nullish(),
  rich_number: z.coerce.number().int().nullish(),
  switch: z.coerce.boolean().nullish(),
  radio: z.coerce.boolean().nullish(),
  select: z.enum(["apple", "orange", "berry"]).nullish(),
  multi_select: z.array(z.string()).default([]),
  sale_start_at: z.preprocess(
  (value) => {
    if (value == null) return undefined;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      return trimmed;
    }
    return value;
  },
  z.coerce.date()
).or(z.literal("").transform(() => undefined)).nullish(),
  date: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  time: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  main_image: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  sub_image: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  description: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  sort_order: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  deletedAt: z.date().nullish(),
});

export const SampleCreateSchema = SampleBaseSchema.omit({ deletedAt: true });

export const SampleUpdateSchema = SampleBaseSchema.partial().omit({ deletedAt: true });
