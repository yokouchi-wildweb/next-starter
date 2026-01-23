// src/features/couponHistory/entities/form.ts

import { z } from "zod";
import { CouponHistoryCreateSchema, CouponHistoryUpdateSchema } from "./schema";

export type CouponHistoryCreateAdditional = {
  // foo: string; フォームに追加する項目
};
export type CouponHistoryCreateFields = z.infer<typeof CouponHistoryCreateSchema> & CouponHistoryCreateAdditional;

export type CouponHistoryUpdateAdditional = {
  // foo: string; フォームに追加する項目
};
export type CouponHistoryUpdateFields = z.infer<typeof CouponHistoryUpdateSchema> & CouponHistoryUpdateAdditional;
