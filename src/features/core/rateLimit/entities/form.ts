// src/features/rateLimit/entities/form.ts

import { z } from "zod";
import { RateLimitCreateSchema, RateLimitUpdateSchema } from "./schema";

export type RateLimitCreateAdditional = {
  // foo: string; フォームに追加する項目
};
export type RateLimitCreateFields = z.infer<typeof RateLimitCreateSchema> & RateLimitCreateAdditional;

export type RateLimitUpdateAdditional = {
  // foo: string; フォームに追加する項目
};
export type RateLimitUpdateFields = z.infer<typeof RateLimitUpdateSchema> & RateLimitUpdateAdditional;
