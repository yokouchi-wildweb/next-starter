// src/features/coupon/hooks/useHardDeleteCoupon.ts

"use client";

import { useHardDeleteDomain } from "@/lib/crud/hooks";
import { couponClient } from "../services/client/couponClient";

export const useHardDeleteCoupon = () => useHardDeleteDomain("coupons/hard-delete", couponClient.hardDelete!, "coupons");
