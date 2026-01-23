// src/features/coupon/hooks/useUpdateCoupon.ts

"use client";

import { useUpdateDomain } from "@/lib/crud/hooks";
import { couponClient } from "../services/client/couponClient";
import type { Coupon } from "../entities";
import type { CouponUpdateFields } from "../entities/form";

export const useUpdateCoupon = () =>
  useUpdateDomain<Coupon, CouponUpdateFields>(
    "coupons/update",
    couponClient.update,
    "coupons",
  );
