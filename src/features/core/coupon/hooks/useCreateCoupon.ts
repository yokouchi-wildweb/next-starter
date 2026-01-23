// src/features/coupon/hooks/useCreateCoupon.ts

"use client";

import { useCreateDomain } from "@/lib/crud/hooks";
import { couponClient } from "../services/client/couponClient";
import type { Coupon } from "../entities";
import type { CouponCreateFields } from "../entities/form";

export const useCreateCoupon = () =>
  useCreateDomain<Coupon, CouponCreateFields>("coupons/create", couponClient.create, "coupons");
