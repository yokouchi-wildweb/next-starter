// src/features/sampleImage/entities/form.ts

import { z } from "zod";
import { SampleImageCreateSchema, SampleImageUpdateSchema } from "./schema";

export type SampleImageCreateAdditional = {
  // foo: string; フォームに追加する項目
};
export type SampleImageCreateFields = z.infer<typeof SampleImageCreateSchema> & SampleImageCreateAdditional;

export type SampleImageUpdateAdditional = {
  // foo: string; フォームに追加する項目
};
export type SampleImageUpdateFields = z.infer<typeof SampleImageUpdateSchema> & SampleImageUpdateAdditional;
