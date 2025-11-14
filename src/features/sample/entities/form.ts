// src/features/sample/entities/form.ts

import { z } from "zod";
import { SampleCreateSchema, SampleUpdateSchema } from "./schema";

export type SampleCreateAdditional = {
  // foo: string; フォームに追加する項目
};
export type SampleCreateFields = z.infer<typeof SampleCreateSchema> & SampleCreateAdditional;

export type SampleUpdateAdditional = {
  // foo: string; フォームに追加する項目
};
export type SampleUpdateFields = z.infer<typeof SampleUpdateSchema> & SampleUpdateAdditional;
