// src/domains/core/couponHistory/entities/couponHistory/model.ts

export type CouponHistory = {
  id: string;
  coupon_id: string;
  redeemer_user_id: string | null;
  metadata: any;
  createdAt: Date | null;
};
