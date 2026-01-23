// src/features/couponHistory/entities/schemaRegistry.ts

import { z } from "zod";

export const CouponHistoryBaseSchema = z.object({

});

export const CouponHistoryCreateSchema = CouponHistoryBaseSchema;

export const CouponHistoryUpdateSchema = CouponHistoryBaseSchema.partial();
