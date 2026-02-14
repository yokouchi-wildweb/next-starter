// src/features/referral/entities/schemaRegistry.ts

import { z } from "zod";

export const ReferralBaseSchema = z.object({
  coupon_id: z.string().uuid(),
  inviter_user_id: z.string().uuid(),
  invitee_user_id: z.string().uuid(),
  status: z.enum(["active", "cancelled"]),
});

export const ReferralCreateSchema = ReferralBaseSchema;

export const ReferralUpdateSchema = ReferralBaseSchema.partial();
