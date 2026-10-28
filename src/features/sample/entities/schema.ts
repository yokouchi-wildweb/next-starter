// src/features/sample/entities/schemaRegistry.ts

import { emptyToNull } from "@/utils/string";
import { nullableDatetime } from "@/lib/crud/utils";
import { storageMediaValueSchema } from "@/lib/storage/schema";
import { z } from "zod";

export const SampleBaseSchema = z.object({
  sample_category_id: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  sample_tag_ids: z.array(z.string()).default([]),
  name: z.string().trim().min(1, { message: "名前は必須です。" }),
  number: z.coerce.number().int().nullish().default(999),
  rich_number: z.coerce.number().int().nullish(),
  switch: z.coerce.boolean().nullish(),
  radio: z.coerce.boolean().nullish(),
  select: z.enum(["apple", "orange", "berry"]).nullish().default("orange"),
  multi_select: z.array(z.string()).nullish(),
  sale_start_at: nullableDatetime.nullish(),
  date: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  time: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  main_image: z.string().trim().nullish()
    .transform((value) => emptyToNull(value))
    .pipe(storageMediaValueSchema.nullish()),
  sub_image: z.string().trim().nullish()
    .transform((value) => emptyToNull(value))
    .pipe(storageMediaValueSchema.nullish()),
  gallery_images: z.array(storageMediaValueSchema).max(8, { message: "ギャラリー画像は8件以下にしてください。" }).default([]),
  images: z.array(storageMediaValueSchema).max(8, { message: "画像は8件以下にしてください。" }).default([]),
  description: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  sort_order: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  deletedAt: z.date().nullish(),
});

export const SampleCreateSchema = SampleBaseSchema.omit({ deletedAt: true });

export const SampleUpdateSchema = SampleBaseSchema.partial().omit({ deletedAt: true });
