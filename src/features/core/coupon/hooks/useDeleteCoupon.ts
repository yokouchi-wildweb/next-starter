// src/features/coupon/hooks/useDeleteCoupon.ts

"use client";

import { useDeleteDomain } from "@/lib/crud/hooks";
import { couponClient } from "../services/client/couponClient";

export const useDeleteCoupon = () => useDeleteDomain("coupons/delete", couponClient.delete, "coupons");
