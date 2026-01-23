// src/features/couponHistory/entities/schema.ts

import { z } from "zod";

export const CouponHistoryBaseSchema = z.object({
  coupon_id: z.string().uuid(),
  redeemer_user_id: z.string().uuid().nullable().optional(),
  metadata: z.record(z.unknown()),
});

export const CouponHistoryCreateSchema = CouponHistoryBaseSchema;

export const CouponHistoryUpdateSchema = CouponHistoryBaseSchema.partial();
