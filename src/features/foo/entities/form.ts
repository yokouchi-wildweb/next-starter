// src/features/foo/entities/form.ts

import { z } from "zod";
import { FooCreateSchema, FooUpdateSchema } from "./schema";

export type FooCreateAdditional = {
  // foo: string; フォームに追加する項目
};
export type FooCreateFields = z.infer<typeof FooCreateSchema> & FooCreateAdditional;

export type FooUpdateAdditional = {
  // foo: string; フォームに追加する項目
};
export type FooUpdateFields = z.infer<typeof FooUpdateSchema> & FooUpdateAdditional;
