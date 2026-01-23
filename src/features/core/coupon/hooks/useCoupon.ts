// src/features/coupon/hooks/useCoupon.ts

"use client";

import { useDomain } from "@/lib/crud/hooks";
import { couponClient } from "../services/client/couponClient";
import type { Coupon } from "../entities";

export const useCoupon = (id?: string | null) =>
  useDomain<Coupon | undefined>(
    id ? `coupon:${id}` : null,
    () => couponClient.getById(id!) as Promise<Coupon>,
  );
