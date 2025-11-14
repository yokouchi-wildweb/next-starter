// src/features/sampleCategory/entities/form.ts

import { z } from "zod";
import { SampleCategoryCreateSchema, SampleCategoryUpdateSchema } from "./schema";

export type SampleCategoryCreateAdditional = {
  // foo: string; フォームに追加する項目
};
export type SampleCategoryCreateFields = z.infer<typeof SampleCategoryCreateSchema> & SampleCategoryCreateAdditional;

export type SampleCategoryUpdateAdditional = {
  // foo: string; フォームに追加する項目
};
export type SampleCategoryUpdateFields = z.infer<typeof SampleCategoryUpdateSchema> & SampleCategoryUpdateAdditional;
