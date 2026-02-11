// src/features/userTag/entities/schemaRegistry.ts

import { emptyToNull } from "@/utils/string";
import { z } from "zod";

export const UserTagBaseSchema = z.object({
  name: z.string().trim().min(1, { message: "タグ名は必須です。" }),
  color: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  description: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
});

export const UserTagCreateSchema = UserTagBaseSchema;

export const UserTagUpdateSchema = UserTagBaseSchema.partial();
