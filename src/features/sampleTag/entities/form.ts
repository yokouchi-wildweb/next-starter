// src/features/sampleTag/entities/form.ts

import { z } from "zod";
import { SampleTagCreateSchema, SampleTagUpdateSchema } from "./schema";

export type SampleTagCreateAdditional = {
  // foo: string; フォームに追加する項目
};
export type SampleTagCreateFields = z.infer<typeof SampleTagCreateSchema> & SampleTagCreateAdditional;

export type SampleTagUpdateAdditional = {
  // foo: string; フォームに追加する項目
};
export type SampleTagUpdateFields = z.infer<typeof SampleTagUpdateSchema> & SampleTagUpdateAdditional;
