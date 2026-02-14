// src/features/referral/entities/form.ts

import { z } from "zod";
import { ReferralCreateSchema, ReferralUpdateSchema } from "./schema";

export type ReferralCreateAdditional = {
  // foo: string; フォームに追加する項目
};
export type ReferralCreateFields = z.infer<typeof ReferralCreateSchema> & ReferralCreateAdditional;

export type ReferralUpdateAdditional = {
  // foo: string; フォームに追加する項目
};
export type ReferralUpdateFields = z.infer<typeof ReferralUpdateSchema> & ReferralUpdateAdditional;
