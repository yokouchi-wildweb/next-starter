// src/features/card/entities/form.ts

import { z } from "zod";
import { CardCreateSchema, CardUpdateSchema } from "./schema";

export type CardCreateAdditional = {
  // foo: string; フォームに追加する項目
};
export type CardCreateFields = z.infer<typeof CardCreateSchema> & CardCreateAdditional;

export type CardUpdateAdditional = {
  // foo: string; フォームに追加する項目
};
export type CardUpdateFields = z.infer<typeof CardUpdateSchema> & CardUpdateAdditional;
