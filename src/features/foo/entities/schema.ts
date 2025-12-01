// src/features/foo/entities/schemaRegistry.ts

import { emptyToNull } from "@/utils/string";
import { z } from "zod";

export const FooBaseSchema = z.object({
  filesize: z.coerce.number().int().nullish(),
  width: z.coerce.number().int().nullish(),
  media: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  mimetype: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
});

export const FooCreateSchema = FooBaseSchema;

export const FooUpdateSchema = FooBaseSchema.partial();
