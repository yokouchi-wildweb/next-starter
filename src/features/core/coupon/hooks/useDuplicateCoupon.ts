// src/features/coupon/hooks/useDuplicateCoupon.ts

"use client";

import { useDuplicateDomain } from "@/lib/crud/hooks";
import { couponClient } from "../services/client/couponClient";

export const useDuplicateCoupon = () => useDuplicateDomain("coupons/duplicate", couponClient.duplicate!, "coupons");
