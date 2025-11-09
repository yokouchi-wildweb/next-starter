// src/features/bar/entities/form.ts

import { z } from "zod";
import { BarCreateSchema, BarUpdateSchema } from "./schema";

export type BarCreateAdditional = {
  // foo: string; フォームに追加する項目
};
export type BarCreateFields = z.infer<typeof BarCreateSchema> & BarCreateAdditional;

export type BarUpdateAdditional = {
  // foo: string; フォームに追加する項目
};
export type BarUpdateFields = z.infer<typeof BarUpdateSchema> & BarUpdateAdditional;
