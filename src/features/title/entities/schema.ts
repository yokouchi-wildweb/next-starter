// src/features/title/entities/schemaRegistry.ts

import { z } from "zod";

export const TitleBaseSchema = z.object({
  name: z.string().min(1, { message: "タイトル名は必須" }),
});

export const TitleCreateSchema = TitleBaseSchema;

export const TitleUpdateSchema = TitleBaseSchema.partial();
