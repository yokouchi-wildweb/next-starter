// src/features/referralReward/entities/form.ts

import { z } from "zod";
import { ReferralRewardCreateSchema, ReferralRewardUpdateSchema } from "./schema";

export type ReferralRewardCreateAdditional = {
  // foo: string; フォームに追加する項目
};
export type ReferralRewardCreateFields = z.infer<typeof ReferralRewardCreateSchema> & ReferralRewardCreateAdditional;

export type ReferralRewardUpdateAdditional = {
  // foo: string; フォームに追加する項目
};
export type ReferralRewardUpdateFields = z.infer<typeof ReferralRewardUpdateSchema> & ReferralRewardUpdateAdditional;
