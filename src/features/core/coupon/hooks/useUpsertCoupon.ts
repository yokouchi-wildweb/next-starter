// src/features/coupon/hooks/useUpsertCoupon.ts

"use client";

import { useUpsertDomain } from "@/lib/crud/hooks";
import { couponClient } from "../services/client/couponClient";
import type { Coupon } from "../entities";
import type { CouponCreateFields } from "../entities/form";

export const useUpsertCoupon = () => {
  const upsert = couponClient.upsert;

  if (!upsert) {
    throw new Error("Couponのアップサート機能が利用できません");
  }

  return useUpsertDomain<Coupon, CouponCreateFields>(
    "coupons/upsert",
    upsert,
    "coupons",
  );
};
