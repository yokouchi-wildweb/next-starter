// src/features/cardTag/entities/form.ts

import { z } from "zod";
import { CardTagCreateSchema, CardTagUpdateSchema } from "./schema";

export type CardTagCreateAdditional = {
  // foo: string; フォームに追加する項目
};
export type CardTagCreateFields = z.infer<typeof CardTagCreateSchema> & CardTagCreateAdditional;

export type CardTagUpdateAdditional = {
  // foo: string; フォームに追加する項目
};
export type CardTagUpdateFields = z.infer<typeof CardTagUpdateSchema> & CardTagUpdateAdditional;
