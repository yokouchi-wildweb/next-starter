// src/features/coupon/hooks/useRestoreCoupon.ts

"use client";

import { useRestoreDomain } from "@/lib/crud/hooks";
import { couponClient } from "../services/client/couponClient";

export const useRestoreCoupon = () => useRestoreDomain("coupons/restore", couponClient.restore!, "coupons");
