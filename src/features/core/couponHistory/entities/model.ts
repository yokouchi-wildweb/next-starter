// src/features/couponHistory/entities/model.ts

export type CouponHistory = {
  id: string;
  coupon_id: string;
  redeemer_id: string | null;
  metadata: any;
  createdAt: Date | null;
};
