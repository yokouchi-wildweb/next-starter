// src/features/series/entities/form.ts

import { z } from "zod";
import { SeriesCreateSchema, SeriesUpdateSchema } from "./schema";

export type SeriesCreateAdditional = {
  // foo: string; フォームに追加する項目
};
export type SeriesCreateFields = z.infer<typeof SeriesCreateSchema> & SeriesCreateAdditional;

export type SeriesUpdateAdditional = {
  // foo: string; フォームに追加する項目
};
export type SeriesUpdateFields = z.infer<typeof SeriesUpdateSchema> & SeriesUpdateAdditional;
