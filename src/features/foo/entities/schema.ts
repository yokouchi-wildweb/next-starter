// src/features/foo/entities/schemaRegistry.ts

import { emptyToNull } from "@/utils/string";
import { z } from "zod";

export const FooBaseSchema = z.object({
  name: z.string().trim().min(1, { message: "nameは必須です。" }),
  filesize: z.coerce.number().int().nullish(),
  media: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
});

export const FooCreateSchema = FooBaseSchema;

export const FooUpdateSchema = FooBaseSchema.partial();
