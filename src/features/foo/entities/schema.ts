// src/features/foo/entities/schemaRegistry.ts

import { z } from "zod";

export const FooBaseSchema = z.object({
  sample_category_id: z.string().trim().min(1, { message: "categoryは必須です。" }),
  name: z.string().trim().min(1, { message: "nameは必須です。" }),
  type: z.enum(["apple", "orange"]),
  num: z.coerce.number().int().nullish(),
});

export const FooCreateSchema = FooBaseSchema;

export const FooUpdateSchema = FooBaseSchema.partial();
