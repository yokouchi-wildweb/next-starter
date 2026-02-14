// src/features/referralReward/entities/schemaRegistry.ts

import { z } from "zod";

export const ReferralRewardBaseSchema = z.object({
  reward_key: z.string().trim().min(1, { message: "報酬キーは必須です。" }),
  status: z.enum(["pending", "fulfilled", "failed"]),
});

export const ReferralRewardCreateSchema = ReferralRewardBaseSchema;

export const ReferralRewardUpdateSchema = ReferralRewardBaseSchema.partial();
