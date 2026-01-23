// src/features/coupon/entities/form.ts

import { z } from "zod";
import { CouponCreateSchema, CouponUpdateSchema } from "./schema";

export type CouponCreateAdditional = {
  // foo: string; フォームに追加する項目
};
export type CouponCreateFields = z.infer<typeof CouponCreateSchema> & CouponCreateAdditional;

export type CouponUpdateAdditional = {
  // foo: string; フォームに追加する項目
};
export type CouponUpdateFields = z.infer<typeof CouponUpdateSchema> & CouponUpdateAdditional;
