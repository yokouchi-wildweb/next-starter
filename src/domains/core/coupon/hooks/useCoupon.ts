// src/domains/coupon/hooks/useCoupon.ts

"use client";

import { useDomain } from "@/lib/crud";
import { couponClient } from "../services/client/couponClient";
import type { Coupon } from "../entities";

export const useCoupon = (id?: string | null) =>
  useDomain<Coupon | undefined>(
    id ? `coupon:${id}` : null,
    () => couponClient.get(id!) as Promise<Coupon>,
  );
