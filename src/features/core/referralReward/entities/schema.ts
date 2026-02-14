// src/features/referralReward/entities/schemaRegistry.ts

import { z } from "zod";

export const ReferralRewardBaseSchema = z.object({
  referral_id: z.string().uuid(),
  reward_key: z.string().trim().min(1, { message: "報酬キーは必須です。" }),
  recipient_user_id: z.string().uuid(),
  status: z.enum(["pending", "fulfilled", "failed"]),
});

export const ReferralRewardCreateSchema = ReferralRewardBaseSchema;

export const ReferralRewardUpdateSchema = ReferralRewardBaseSchema.partial();
