// src/features/title/entities/form.ts

import { z } from "zod";
import { TitleCreateSchema, TitleUpdateSchema } from "./schema";

export type TitleCreateAdditional = {
  // foo: string; フォームに追加する項目
};
export type TitleCreateFields = z.infer<typeof TitleCreateSchema> & TitleCreateAdditional;

export type TitleUpdateAdditional = {
  // foo: string; フォームに追加する項目
};
export type TitleUpdateFields = z.infer<typeof TitleUpdateSchema> & TitleUpdateAdditional;
