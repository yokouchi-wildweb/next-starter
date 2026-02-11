// src/features/userTag/entities/form.ts

import { z } from "zod";
import { UserTagCreateSchema, UserTagUpdateSchema } from "./schema";

export type UserTagCreateAdditional = {
  // foo: string; フォームに追加する項目
};
export type UserTagCreateFields = z.infer<typeof UserTagCreateSchema> & UserTagCreateAdditional;

export type UserTagUpdateAdditional = {
  // foo: string; フォームに追加する項目
};
export type UserTagUpdateFields = z.infer<typeof UserTagUpdateSchema> & UserTagUpdateAdditional;
