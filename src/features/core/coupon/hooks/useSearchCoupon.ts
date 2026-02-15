// src/features/coupon/hooks/useSearchCoupon.ts

"use client";

import { useSearchDomain } from "@/lib/crud/hooks";
import { couponClient } from "../services/client/couponClient";
import type { Coupon } from "../entities";
import type { SearchParams } from "@/lib/crud/types";

export type CouponSearchParams = NonNullable<typeof couponClient.search> extends (
  params: infer P,
) => Promise<unknown>
  ? P
  : SearchParams;

export const useSearchCoupon = (params: CouponSearchParams) => {
  const search = couponClient.search;

  if (!search) {
    throw new Error("Couponの検索機能が利用できません");
  }

  return useSearchDomain<Coupon, CouponSearchParams>(
    "coupons/search",
    search,
    params,
  );
};
