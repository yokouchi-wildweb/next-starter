// src/features/referral/entities/schemaRegistry.ts

import { z } from "zod";

export const ReferralBaseSchema = z.object({
  status: z.enum(["active", "cancelled"]),
});

export const ReferralCreateSchema = ReferralBaseSchema;

export const ReferralUpdateSchema = ReferralBaseSchema.partial();
